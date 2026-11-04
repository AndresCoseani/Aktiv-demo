import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from backup_supabase import respaldar_storage, verificar, contar_copy
from restore_drill import exigir_local


class BackupTests(unittest.TestCase):
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
