"""Prueba con PostgreSQL 17 real y datos ficticios; nunca acepta un host remoto."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import uuid
import threading
import tarfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
from unittest.mock import patch

from backup_supabase import descargar_postgres, preparar_datos, verificar, respaldar_storage
from restore_drill import exigir_local, sql, main as restaurar
from extraer_backup import extraer


@unittest.skipUnless(os.environ.get("BACKUP_TEST_DB_URL"), "Requiere PostgreSQL local descartable")
class BackupPostgresTests(unittest.TestCase):
    def test_dump_extraccion_restore_y_cifrado_reales(self):
        base = os.environ["BACKUP_TEST_DB_URL"]
        exigir_local(base, "http://localhost")
        prefijo = "backup_check_" + uuid.uuid4().hex
        origen, destino = prefijo + "_source", prefijo + "_restore"
        source = base.rsplit("/", 1)[0] + "/" + origen
        target = base.rsplit("/", 1)[0] + "/" + destino
        pdf = b"%PDF-1.4 certificado ficticio"
        escrituras = {}
        class StoragePrueba(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def responder(self, contenido):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(contenido)
            def do_GET(self):
                if self.path.endswith('/bucket'):
                    self.responder(b'[{"id":"certificados","name":"certificados","public":false}]')
                else:
                    self.responder(pdf)
            def do_POST(self):
                contenido = self.rfile.read(int(self.headers.get('Content-Length', '0')))
                if '/object/list/' in self.path:
                    self.responder(b'[{"id":"ficticio","name":"certificado.pdf","metadata":{"mimetype":"application/pdf"}}]')
                else:
                    escrituras[self.path] = contenido
                    self.responder(b'{}')
            def do_PUT(self):
                self.rfile.read(int(self.headers.get('Content-Length', '0')))
                self.responder(b'{}')
        storage = ThreadingHTTPServer(('127.0.0.1', 0), StoragePrueba)
        hilo = threading.Thread(target=storage.serve_forever, daemon=True)
        hilo.start()
        api = f'http://127.0.0.1:{storage.server_port}'
        try:
            sql(base, f'create database "{origen}";')
            sql(base, f'create database "{destino}";')
            estructura = """
                create schema auth;
                create table auth.users(id int primary key);
                create table auth.identities(id int primary key, user_id int references auth.users);
                create table public.profiles(id int primary key references auth.users);
                create table public.alumnos(id int primary key, user_id int references auth.users);
                create table public.planes_mensuales(id int primary key, alumno_id int references public.alumnos);
                create table public.horarios_clase(id int primary key);
                create table public.fichas_medicas(id int primary key, cert_ruta text);
            """
            sql(source, estructura + """
                insert into auth.users values (1);
                insert into auth.identities values (1,1);
                insert into public.profiles values (1);
                insert into public.alumnos values (1,1);
                insert into public.planes_mensuales values (1,1);
                insert into public.fichas_medicas values (1,'certificado.pdf');
            """)
            sql(target, estructura)
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                archivo = root / "database.dump"
                # El contenedor de prueba no usa TLS; no altera las opciones de producción.
                descargar_postgres(source + "?sslmode=disable", archivo)
                # Reproducir el fallo anterior con el mismo archivo real.
                anterior = subprocess.run(["pg_restore", "--data-only"], input=archivo.read_bytes(), capture_output=True)
                self.assertNotEqual(anterior.returncode, 0)
                self.assertIn(b"--file", anterior.stderr)
                counts = preparar_datos(archivo, root)
                self.assertEqual(counts["auth.users"], 1)
                self.assertEqual(counts["auth.identities"], 1)
                self.assertEqual(counts["public.planes_mensuales"], 1)
                self.assertEqual(counts["public.horarios_clase"], 0)
                files = [{"file": p.name, "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                         for p in (archivo, root / "public-data.sql", root / "auth-data.sql")]
                manifest = {"created_at_utc": datetime.now(timezone.utc).isoformat(), "counts": counts,
                            "files": files, **respaldar_storage(api, "clave-ficticia", root)}
                (root / "manifest.json").write_text(json.dumps(manifest))
                verificar(root, manifest)
                with patch.dict(os.environ, {"LOCAL_SUPABASE_DB_URL": target, "LOCAL_SUPABASE_URL": api, "LOCAL_SUPABASE_SERVICE_ROLE_KEY": "ficticia"}), \
                     patch("sys.argv", ["restore_drill.py", str(root)]):
                    restaurar()
                self.assertEqual(escrituras['/storage/v1/object/certificados/certificado.pdf'], pdf)
                self.assertEqual(sql(target, "select count(*) from public.planes_mensuales;"), "1")
                # Detectar también una FK rota, aun si los conteos coinciden.
                sql(target, "set session_replication_role=replica; update public.alumnos set user_id=999;")
                with self.assertRaisesRegex(RuntimeError, "restauración SQL"):
                    sql(target, Path(__file__).with_name("restore_fks.sql").read_text())
                # Cifrado y recuperación reales con una clave únicamente de prueba.
                paquete = root / "check.tar.gz"
                with tarfile.open(paquete, 'w:gz') as tar:
                    for nombre in ['manifest.json'] + [f['file'] for f in manifest['files'] + manifest['objects']]:
                        tar.add(root / nombre, arcname='./' + nombre)
                cifrado = root / "check.gpg"
                subprocess.run(["gpg", "--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase-fd", "0", "--symmetric", "--cipher-algo", "AES256", "--output", str(cifrado), str(paquete)],
                               input=b"clave-ficticia-para-esta-prueba", check=True, capture_output=True)
                recuperado = subprocess.run(["gpg", "--batch", "--quiet", "--pinentry-mode", "loopback", "--passphrase-fd", "0", "--decrypt", str(cifrado)],
                                             input=b"clave-ficticia-para-esta-prueba", check=True, capture_output=True)
                self.assertEqual(recuperado.stdout, paquete.read_bytes())
                descifrado = root / 'recuperado.tar.gz'
                descifrado.write_bytes(recuperado.stdout)
                recuperacion = root / 'recuperacion'
                extraer(descifrado, recuperacion)
                verificar(recuperacion, manifest)
                sql(target, 'truncate auth.users cascade; truncate public.horarios_clase,public.fichas_medicas;')
                with patch.dict(os.environ, {"LOCAL_SUPABASE_DB_URL": target, "LOCAL_SUPABASE_URL": api, "LOCAL_SUPABASE_SERVICE_ROLE_KEY": "ficticia"}), \
                     patch("sys.argv", ["restore_drill.py", str(recuperacion)]):
                    restaurar()
                self.assertEqual(sql(target, 'select user_id from public.alumnos;'), '1')
        finally:
            storage.shutdown()
            storage.server_close()
            hilo.join()
            for nombre in (destino, origen):
                sql(base, f'drop database if exists "{nombre}" with (force);')


if __name__ == "__main__":
    unittest.main()
