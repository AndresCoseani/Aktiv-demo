"""Ensayo destructivo SOLO en Supabase loopback vacío. Nunca acepta producción."""
import json
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote, urlparse
from urllib.request import Request, build_opener
from backup_supabase import SinRedireccion, pedir, verificar, ErrorBackup, error_postgres_seguro


def exigir_local(db_url, api_url):
    for url in [db_url, api_url]:
        parsed = urlparse(url)
        if parsed.hostname not in ("127.0.0.1", "localhost"):
            raise ValueError("Restore bloqueado: solo se permiten destinos loopback")
    if urlparse(db_url).scheme not in ("postgres", "postgresql") or urlparse(api_url).scheme != "http":
        raise ValueError("El destino debe ser Supabase local")


def sql(db_url, texto):
    exigir_local(db_url, "http://localhost")
    result = subprocess.run(["psql", "--dbname", db_url, "--no-password", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
        input=texto.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ErrorBackup("Falló validación/restauración SQL local. Detalle filtrado:\n" + error_postgres_seguro(result.stderr))
    return result.stdout.decode().strip()


def escribir_local(url, key, ruta, metodo, contenido, content_type="application/json"):
    # Revalidar incluso en helper para que no pueda usarse contra Supabase remoto.
    exigir_local("postgresql://localhost/postgres", url)
    req = Request(url + "/storage/v1/" + ruta, data=contenido, method=metodo,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": content_type, "x-upsert": "true"})
    with build_opener(SinRedireccion()).open(req, timeout=60) as response:
        return response.read()


def main():
    db_url, url, key = (os.environ[k] for k in ["LOCAL_SUPABASE_DB_URL", "LOCAL_SUPABASE_URL", "LOCAL_SUPABASE_SERVICE_ROLE_KEY"])
    exigir_local(db_url, url)
    root = Path(sys.argv[1]).resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf8"))
    verificar(root, manifest)
    antiguedad = (datetime.now(timezone.utc) - datetime.fromisoformat(manifest["created_at_utc"])).total_seconds()
    if antiguedad > 72 * 3600 or antiguedad < -300:
        raise ValueError("Backup viejo o con fecha futura: comprobar ejecuciones nocturnas")
    counts = manifest["counts"]
    requeridas = ["public.profiles", "public.alumnos", "public.planes_mensuales", "public.horarios_clase", "auth.users", "auth.identities"]
    if any(t not in counts for t in requeridas) or counts["auth.users"] < 1 or counts["public.profiles"] < 1:
        raise ValueError("Snapshot sin tablas/usuarios requeridos")
    for tabla, n in counts.items():
        if not re.fullmatch(r"(public|auth)\.[a-z_][a-z0-9_]*", tabla) or type(n) is not int or n < 0:
            raise ValueError("Manifiesto de conteos inválido")
    sql(db_url, "do $$ begin if exists(select 1 from auth.users) or exists(select 1 from public.profiles) then raise exception 'Destino no vacío'; end if; end $$;")
    # Reconstruye triggers/RLS desde migraciones. Importa solo datos, sin borrar FKs.
    auth = (root / "auth-data.sql").read_text(encoding="utf8")
    public = (root / "public-data.sql").read_text(encoding="utf8")
    sql(db_url, "begin; set local session_replication_role = replica;\n" + auth + "\n" + public + "\ncommit;")
    union = " union all ".join(f"select '{t}' as tabla,count(*) as n from {t}" for t in counts)
    restaurados = json.loads(sql(db_url, f"select json_object_agg(tabla,n) from ({union}) x;"))
    if restaurados != counts:
        raise ValueError("Los conteos restaurados no coinciden con el snapshot")
    # Revalidar todas las FK de public, incluso las que apuntan a Auth.
    sql(db_url, Path(__file__).with_name("restore_fks.sql").read_text(encoding="utf8"))
    existentes = json.loads(pedir(url + "/storage/v1/bucket", key))
    ids = {b["id"] for b in existentes}
    for bucket in manifest["buckets"]:
        datos = {k: bucket[k] for k in ["id", "name", "public", "file_size_limit", "allowed_mime_types"] if k in bucket}
        bucket_id = bucket["id"]
        if bucket_id == "certificados" and bucket.get("public"):
            raise ValueError("El bucket de certificados debe ser privado")
        if bucket_id in ids:
            escribir_local(url, key, "bucket/" + quote(bucket_id, safe=""), "PUT", json.dumps(datos).encode())
        else:
            escribir_local(url, key, "bucket", "POST", json.dumps(datos).encode())
    for objeto in manifest["objects"]:
        contenido = (root / objeto["file"]).read_bytes()
        ruta = "object/" + quote(objeto["bucket"], safe="") + "/" + quote(objeto["name"], safe="/")
        mime = (objeto.get("metadata") or {}).get("mimetype", "application/octet-stream")
        escribir_local(url, key, ruta, "POST", contenido, mime)
        if pedir(url + "/storage/v1/" + ruta, key) != contenido:
            raise ValueError("Archivo restaurado distinto del original")
    certificados = json.loads(sql(db_url, "select coalesce(json_agg(cert_ruta),'[]'::json) from public.fichas_medicas where cert_ruta is not null;"))
    nombres = {(o["bucket"], o["name"]) for o in manifest["objects"]}
    if any(("certificados", ruta) not in nombres for ruta in certificados):
        raise ValueError("Hay certificados referenciados sin archivo en el backup")
    print(f"Restore local OK: {len(counts)} tablas con conteos exactos, FKs completas, Auth y {len(manifest['objects'])} archivos recuperados.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        detalle = str(e) if isinstance(e, ErrorBackup) else type(e).__name__
        print(f"Restore drill fallido: {detalle}. Nunca se ejecuta contra destinos remotos.", file=sys.stderr)
        sys.exit(1)
