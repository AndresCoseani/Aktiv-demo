import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import backup_supabase
from backup_supabase import respaldar_storage, verificar, contar_copy, diagnosticar_dump
from restore_drill import exigir_local


class BackupTests(unittest.TestCase):
    def test_snapshot_nativo_prepara_auth_y_public_sin_exponer_dsn(self):
        dsn = "postgresql://usuario:privada@pooler/postgres"
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "backup"
            def ejecutar(args, **kwargs):
                self.assertNotIn(dsn, " ".join(args))
                if args[0] == "pg_dump":
                    self.assertEqual(kwargs["env"]["PGDATABASE"], dsn)
                    self.assertIn("--schema=public", args)
                    self.assertIn("--schema=auth", args)
                    kwargs["stdout"].write(b"archivo custom simulado")
                elif "--list" not in args:
                    self.assertEqual(kwargs["stdin"].read(), b"archivo custom simulado")
                    schema = "auth.users" if "--schema=auth" in args else "public.profiles"
                    kwargs["stdout"].write(f"COPY {schema} (id) FROM stdin;\nusuario\n\\.\n".encode())
                return SimpleNamespace(returncode=0, stderr=b"")
            with patch.dict("os.environ", {"SUPABASE_URL": "https://prueba.supabase.co", "SUPABASE_DB_URL": dsn, "SUPABASE_SERVICE_ROLE_KEY": "prueba"}), \
                 patch("sys.argv", ["backup_supabase.py", str(destino)]), \
                 patch("backup_supabase.subprocess.run", side_effect=ejecutar), \
                 patch("backup_supabase.respaldar_storage", return_value={"buckets": [], "objects": []}):
                backup_supabase.main()
            manifest = json.loads((destino / "manifest.json").read_text())
            self.assertEqual(manifest["counts"], {"public.profiles": 1, "auth.users": 1})
            verificar(destino, manifest)

    def test_diagnostico_dump_no_expone_salida_ni_credenciales(self):
        secreto = "postgresql://usuario:clave-super-privada@host/postgres"
        for error, esperado in [
            ("password authentication failed", "Autenticación"),
            ("Tenant or user not found", "pooler"),
            ("Network is unreachable", "IPv6"),
            ("server version mismatch", "versión"),
            ("permission denied", "permisos"),
            ("error inesperado", "no clasificada"),
        ]:
            with self.subTest(error=error):
                mensaje = diagnosticar_dump(f"{error}: {secreto}".encode())
                self.assertIn(esperado, mensaje)
                self.assertNotIn(secreto, mensaje)
                self.assertNotIn("clave-super-privada", mensaje)

    def test_conteos_del_snapshot_no_confunden_newlines_escapadas(self):
        self.assertEqual(contar_copy("COPY public.alumnos (id, nombre) FROM stdin;\n1\tNombre\\nLargo\n\\.\nCOPY auth.users (id) FROM stdin;\n1\n\\.\n"), {"public.alumnos": 1, "auth.users": 1})
        with self.assertRaises(ValueError):
            contar_copy("COPY public.alumnos (id) FROM stdin;\n1\n")

    def test_restore_nunca_acepta_destinos_remotos(self):
        exigir_local("postgresql://postgres:prueba@127.0.0.1:54322/postgres", "http://localhost:54321")
        with self.assertRaises(ValueError):
            exigir_local("postgresql://postgres:prueba@db.proyecto.supabase.co/postgres", "http://localhost:54321")
        with self.assertRaises(ValueError):
            exigir_local("postgresql://127.0.0.1/postgres", "https://proyecto.supabase.co")
    def test_descarga_recursiva_y_nombre_no_interpretado_como_ruta(self):
        def pedir(url, key, payload=None):
            self.assertEqual(key, "solo-prueba")
            if url.endswith("/bucket"):
                return json.dumps([{"id": "certificados", "public": False}]).encode()
            if "/object/list/" in url:
                filas = [{"id": None, "name": "alumno"}] if payload["prefix"] == "" else [{"id": "id", "name": "../certificado.pdf"}]
                return json.dumps(filas).encode()
            return b"PDF ficticio"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = respaldar_storage("https://proyecto.supabase.co", "solo-prueba", root, pedir)
            self.assertEqual(len(manifest["objects"]), 1)
            self.assertEqual(manifest["objects"][0]["name"], "alumno/../certificado.pdf")
            manifest["files"] = []
            verificar(root, manifest)
            (root / manifest["objects"][0]["file"]).write_bytes(b"alterado")
            with self.assertRaises(ValueError):
                verificar(root, manifest)

    def test_paginacion_no_trunca_cien_objetos(self):
        offsets = []
        def pedir(url, key, payload=None):
            if url.endswith("/bucket"):
                return b'[{"id":"certificados"}]'
            if "/object/list/" in url:
                offsets.append(payload["offset"])
                filas = [{"id": str(i), "name": str(i)} for i in range(100)] if payload["offset"] == 0 else [{"id": "100", "name": "100"}]
                return json.dumps(filas).encode()
            return b"dato"
        with tempfile.TemporaryDirectory() as tmp:
            manifest = respaldar_storage("https://proyecto.supabase.co", "prueba", Path(tmp), pedir)
            self.assertEqual(offsets, [0, 100])
            self.assertEqual(len(manifest["objects"]), 101)

    def test_fallo_de_descarga_no_declara_respaldo_completo(self):
        def pedir(url, key, payload=None):
            if url.endswith("/bucket"):
                return b'[{"id":"certificados"}]'
            if "/object/list/" in url:
                return b'[{"id":"1","name":"cert.pdf"}]'
            raise RuntimeError("503 simulado")
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(RuntimeError):
                respaldar_storage("https://proyecto.supabase.co", "prueba", Path(tmp), pedir)
            self.assertFalse((Path(tmp) / "manifest.json").exists())

    def test_verificacion_rechaza_rutas_afuera(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                verificar(Path(tmp), {"objects": [], "files": [{"file": "../fuera", "bytes": 0, "sha256": hashlib.sha256(b"").hexdigest()}]})


if __name__ == "__main__":
    unittest.main()
