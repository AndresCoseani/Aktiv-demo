"""Respaldo de solo lectura. Los archivos privados se cifran en el workflow."""
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler


class ErrorBackup(RuntimeError):
    """Mensaje controlado por el script, sin salida cruda ni credenciales."""


def error_postgres_seguro(stderr):
    """Solo líneas de error, sin SQL ni valores privados, incluso sin mask de GitHub."""
    texto = stderr.decode("utf8", errors="replace")
    privados = set()
    for nombre, valor in os.environ.items():
        if valor and (nombre.startswith(("SUPABASE_", "R2_")) or
                      nombre in ("PGDATABASE", "PGPASSWORD", "BACKUP_GPG_PASSPHRASE")):
            privados.update((valor, unquote(valor), quote(valor, safe="")))
            if nombre in ("SUPABASE_DB_URL", "PGDATABASE"):
                try:
                    uri = urlparse(valor)
                    for parte in (uri.username, uri.password, uri.hostname, uri.path.lstrip("/")):
                        if parte:
                            privados.update((parte, unquote(parte), quote(unquote(parte), safe="")))
                except ValueError:
                    pass
    for privado in sorted(privados, key=len, reverse=True):
        texto = re.sub(re.escape(privado), "[oculto]", texto, flags=re.IGNORECASE)
    texto = re.sub(r"[a-z][a-z0-9+.-]*://[^\s]+", "[URL oculta]", texto, flags=re.IGNORECASE)
    texto = re.sub(r"\b(?:password|passwd|pwd|token|apikey|authorization)\s*[:=]\s*[^\s]+", "[credencial oculta]", texto, flags=re.IGNORECASE)
    # PostgreSQL puede citar usuarios, rutas, nombres o valores de una fila.
    texto = re.sub(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*' ''', "[valor oculto]", texto, flags=re.VERBOSE)
    lineas = []
    for linea in texto.splitlines():
        if re.match(r"^(?:pg_(?:dump|restore): (?:error|warning):|FATAL:|ERROR:)", linea.strip(), re.IGNORECASE):
            # No imprimir el SQL que pg_dump adjunta a ciertos errores.
            linea = re.split(r"query was:|statement:", linea, maxsplit=1, flags=re.IGNORECASE)[0]
            lineas.append("".join(c for c in linea if c.isprintable())[:500])
    return "\n".join(lineas[:6]) or "PostgreSQL no devolvió una línea de error reconocible."


def diagnosticar_dump(stderr):
    texto = stderr.decode("utf8", errors="replace").lower()
    causas = [
        (("connection to server on socket",), "pg_dump intentó conectarse a un PostgreSQL local. Revisar que SUPABASE_DB_URL incluya el host remoto y se pase con --dbname."),
        (("password authentication failed", "authentication failed", "wrong password"), "Autenticación PostgreSQL rechazada. Revisar usuario y contraseña URL-encoded de SUPABASE_DB_URL."),
        (("tenant or user not found",), "El pooler no reconoce el proyecto o usuario. Copiar la conexión Session pooler del proyecto correcto."),
        (("could not translate host name", "name or service not known", "temporary failure in name resolution"), "No se pudo resolver el servidor PostgreSQL. Revisar el host de SUPABASE_DB_URL."),
        (("network is unreachable", "no route to host"), "El servidor PostgreSQL no es accesible desde el runner. Usar Session pooler en el puerto 5432 si la conexión directa requiere IPv6."),
        (("connection timed out", "timeout expired"), "La conexión PostgreSQL agotó el tiempo de espera. Revisar red y restricciones de acceso."),
        (("connection refused",), "PostgreSQL rechazó la conexión. Revisar servidor, puerto y estado del proyecto."),
        (("server version mismatch", "aborting because of server version"), "La versión de pg_dump es anterior a la del servidor. Actualizar la imagen PostgreSQL del backup."),
        (("permission denied", "must be owner",), "El usuario PostgreSQL no tiene permisos para leer todo el respaldo."),
        (("ssl error", "certificate verify failed", "server does not support ssl"), "Falló la conexión TLS de PostgreSQL. Revisar los parámetros SSL."),
        (("invalid uri", "invalid percent-encoded", "invalid integer value", "missing key/value separator"), "SUPABASE_DB_URL tiene un formato inválido. Revisar la URL y codificar los caracteres especiales de la contraseña."),
        (("cannot connect to the docker daemon", "error during connect", "pull access denied", "failed to resolve reference"), "Docker no pudo iniciar o descargar la imagen PostgreSQL."),
    ]
    for patrones, mensaje in causas:
        if any(patron in texto for patron in patrones):
            return mensaje
    return "pg_dump falló por una causa no clasificada. Detalle filtrado:\n" + error_postgres_seguro(stderr)


class SinRedireccion(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Storage respondió con una redirección inesperada")


def pedir(url, key, payload=None):
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    data = None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers["Content-Type"] = "application/json"
    for intento in range(3):
        try:
            with build_opener(SinRedireccion()).open(Request(url, data=data, headers=headers), timeout=60) as r:
                return r.read()
        except HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or intento == 2:
                raise ErrorBackup(f"Storage no pudo respaldarse (HTTP {e.code}). Revisar SUPABASE_URL, clave service_role y permisos.") from None
        except URLError:
            if intento == 2:
                raise ErrorBackup("No se pudo conectar con Storage") from None
        time.sleep(2 ** intento)


def respaldar_storage(url, key, destino, request=pedir):
    buckets = json.loads(request(f"{url}/storage/v1/bucket", key))
    if not isinstance(buckets, list):
        raise ValueError("La lista de buckets no es válida")
    objetos = []
    carpeta = destino / "storage"
    carpeta.mkdir()
    for bucket in buckets:
        bucket_id = bucket["id"]
        pendientes = [""]
        vistos = set()
        while pendientes:
            prefix = pendientes.pop()
            if prefix in vistos:
                raise ValueError("Carpeta repetida en Storage")
            vistos.add(prefix)
            offset = 0
            while True:
                filas = json.loads(request(f"{url}/storage/v1/object/list/{quote(bucket_id, safe='')}", key,
                    {"prefix": prefix, "limit": 100, "offset": offset, "sortBy": {"column": "name", "order": "asc"}}))
                if not isinstance(filas, list):
                    raise ValueError("La lista de objetos no es válida")
                for fila in filas:
                    nombre = f"{prefix}/{fila['name']}" if prefix else fila["name"]
                    if fila.get("id") is None:
                        pendientes.append(nombre)
                        continue
                    # El nombre remoto jamás se interpreta como una ruta local.
                    archivo = hashlib.sha256(f"{bucket_id}\0{nombre}".encode()).hexdigest()
                    contenido = request(f"{url}/storage/v1/object/{quote(bucket_id, safe='')}/{quote(nombre, safe='/')}", key)
                    (carpeta / archivo).write_bytes(contenido)
                    objetos.append({"bucket": bucket_id, "name": nombre, "file": f"storage/{archivo}",
                                    "bytes": len(contenido), "sha256": hashlib.sha256(contenido).hexdigest(),
                                    "metadata": fila.get("metadata")})
                if len(filas) < 100:
                    break
                offset += len(filas)
    return {"buckets": buckets, "objects": objetos}


def verificar(destino, manifest):
    for entrada in manifest["files"] + manifest["objects"]:
        path = (destino / entrada["file"]).resolve()
        if not path.is_relative_to(destino.resolve()):
            raise ValueError("Ruta fuera del respaldo")
        contenido = path.read_bytes()
        if len(contenido) != entrada["bytes"] or hashlib.sha256(contenido).hexdigest() != entrada["sha256"]:
            raise ValueError("El respaldo tiene un archivo incompleto o alterado")


def contar_copy(texto):
    """Conteos del mismo snapshot que el dump, sin volver a consultar producción."""
    counts = {}
    tabla = None
    for linea in texto.splitlines():
        if tabla is not None:
            if linea == r"\.":
                tabla = None
            else:
                counts[tabla] += 1
        else:
            match = re.match(r'^COPY (public|auth)\.([a-z_][a-z0-9_]*) \(', linea)
            if match:
                tabla = f"{match[1]}.{match[2]}"
                if tabla in counts:
                    raise ValueError("COPY repetido")
                counts[tabla] = 0
    if tabla is not None:
        raise ValueError("COPY incompleto")
    return counts


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--verify":
        destino = Path(sys.argv[2]).resolve()
        manifest = json.loads((destino / "manifest.json").read_text(encoding="utf8"))
        verificar(destino, manifest)
        print("Integridad verificada: base y archivos coinciden con el manifiesto.")
        return
    url = os.environ["SUPABASE_URL"].strip().rstrip("/")
    dsn = os.environ["SUPABASE_DB_URL"].strip()
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()
    if urlparse(url).scheme != "https" or not urlparse(url).hostname.endswith(".supabase.co"):
        raise ValueError("Usar la URL HTTPS del proyecto Supabase")
    if urlparse(dsn).scheme not in ("postgres", "postgresql"):
        raise ValueError("Falta la conexión PostgreSQL")
    if not urlparse(dsn).hostname or urlparse(dsn).hostname in ("localhost", "127.0.0.1", "::1"):
        raise ErrorBackup("SUPABASE_DB_URL debe incluir el host remoto de Supabase, no un socket ni un servidor local.")
    destino = Path(sys.argv[1]).resolve()
    destino.mkdir(mode=0o700, parents=True, exist_ok=False)
    env = {**os.environ, "PGSSLMODE": "require", "PGCONNECT_TIMEOUT": "30"}
    archivo = destino / "database.dump"
    print("Etapa 1/4: descargar PostgreSQL con pg_dump (solo lectura).", flush=True)
    with archivo.open("wb") as salida:
        # Cliente nativo 17 como Andera. Un snapshot para public + Auth;
        # excluir los esquemas internos de Storage, Vault y extensiones.
        # Pasar la URI explícitamente, como Andera. PGDATABASE por sí solo
        # no garantiza expandir sus parámetros de conexión. No loguear args.
        resultado = subprocess.run(["pg_dump", "--dbname", dsn, "--no-password", "--format=custom", "--no-owner", "--no-privileges",
                                    "--schema=public", "--schema=auth"], env=env, stdout=salida, stderr=subprocess.PIPE)
    if resultado.returncode != 0:
        raise ErrorBackup(diagnosticar_dump(resultado.stderr))
    print("Etapa 2/4: verificar el archivo PostgreSQL.", flush=True)
    with archivo.open("rb") as entrada:
        listado = subprocess.run(["pg_restore", "--list"], stdin=entrada, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if listado.returncode != 0 or archivo.stat().st_size == 0:
        raise ErrorBackup("El archivo PostgreSQL no es válido")
    print("Etapa 3/4: descargar los archivos de Storage (solo lectura).", flush=True)
    manifest = respaldar_storage(url, key, destino)
    print("Etapa 4/4: preparar y verificar datos para la restauración local.", flush=True)
    counts = {}
    for nombre, opciones in [("public-data.sql", ["--schema=public"]),
                             ("auth-data.sql", ["--schema=auth", "--table=users", "--table=identities"])]:
        with archivo.open("rb") as entrada, (destino / nombre).open("wb") as salida:
            extraer = subprocess.run(["pg_restore", "--data-only", "--no-owner", "--no-privileges", *opciones],
                                     stdin=entrada, stdout=salida, stderr=subprocess.PIPE)
        if extraer.returncode != 0:
            raise ErrorBackup("No se pudo preparar el ensayo de restore")
        counts.update(contar_copy((destino / nombre).read_text(encoding="utf8")))
    if counts.get("auth.users", 0) < 1 or counts.get("public.profiles", 0) < 1:
        raise ValueError("El backup no contiene usuarios/perfiles de la app")
    files = []
    for nombre in ["database.dump", "public-data.sql", "auth-data.sql"]:
        contenido = (destino / nombre).read_bytes()
        files.append({"file": nombre, "bytes": len(contenido), "sha256": hashlib.sha256(contenido).hexdigest()})
    manifest.update({"version": 1, "project": urlparse(url).hostname.split(".")[0],
        "created_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "commit": os.environ.get("GITHUB_SHA"), "counts": counts, "files": files})
    verificar(destino, manifest)
    (destino / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    print(f"Respaldo verificado: base PostgreSQL y {len(manifest['objects'])} archivos de Storage. Pendiente cifrado.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # No imprimir trazas de librerías ni credenciales de conexión.
        detalle = str(e) if isinstance(e, ErrorBackup) else f"{type(e).__name__}. Revisar configuración y conectividad."
        print(f"Backup fallido: {detalle} No se subió una copia parcial.", file=sys.stderr)
        sys.exit(1)
