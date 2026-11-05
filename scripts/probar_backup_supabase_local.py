"""Prueba destructiva solo dentro del proyecto Docker aktiv_backup_validation.

Se monta el config/status de ese proyecto descartable en /validation y scripts en
/scripts. No acepta URLs ni claves de producción. No usar contra una base propia.
"""
import hashlib
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backup_supabase import descargar_postgres, preparar_datos, respaldar_storage, verificar
from restore_drill import main as restaurar, sql


def main():
    config = Path('/validation/supabase/config.toml').read_text()
    assert 'project_id = "aktiv_backup_validation"' in config
    assert 'port = 55422' in config
    status = json.loads(Path('/validation/status.json').read_text(encoding='utf-8-sig'))
    assert status['DB_URL'] == 'postgresql://postgres:postgres@127.0.0.1:55422/postgres'
    db = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
    key = status['SERVICE_ROLE_KEY']

    class ProxyLocal(BaseHTTPRequestHandler):
        def log_message(self, *args): pass
        def reenviar(self):
            conexion = http.client.HTTPConnection('supabase_kong_aktiv_backup_validation', 8000, timeout=60)
            cuerpo = self.rfile.read(int(self.headers.get('Content-Length', '0')))
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'connection')}
            try:
                conexion.request(self.command, self.path, cuerpo, headers)
                respuesta = conexion.getresponse()
                self.send_response(respuesta.status)
                for k, v in respuesta.getheaders():
                    if k.lower() in ('content-type',): self.send_header(k, v)
                self.end_headers()
                self.wfile.write(respuesta.read())
            finally: conexion.close()
        do_GET = do_POST = do_PUT = do_DELETE = reenviar

    proxy = ThreadingHTTPServer(('127.0.0.1', 0), ProxyLocal)
    hilo = threading.Thread(target=proxy.serve_forever, daemon=True)
    hilo.start()
    api = f'http://127.0.0.1:{proxy.server_port}'
    def pedir(path, datos=None, method='POST', contenido=None, mime='application/json'):
        body = contenido if contenido is not None else (json.dumps(datos).encode() if datos is not None else None)
        req = Request(api + path, data=body, method=method,
                      headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': mime, 'x-upsert':'true'})
        try:
            with urlopen(req, timeout=60) as r: return r.read()
        except HTTPError as e:
            # Solo datos ficticios dentro de esta instancia descartable.
            raise RuntimeError(f'API local {path}: HTTP {e.code}, {e.read().decode()}') from None

    try:
        assert sql(db, 'select count(*) from auth.users;') == '0', 'La instancia de prueba debe estar vacía'
        password = 'Clave-ficticia-local-2026!'
        coach = json.loads(pedir('/auth/v1/admin/users', {'email':'coach@backup.test','password':password,'email_confirm':True}))['id']
        alumno_user = json.loads(pedir('/auth/v1/admin/users', {'email':'alumno@backup.test','password':password,'email_confirm':True}))['id']
        alumno = 'a0000000-0000-4000-8000-000000000010'
        plan = 'a0000000-0000-4000-8000-000000000011'
        sesion = 'a0000000-0000-4000-8000-000000000012'
        ejercicio = 'a0000000-0000-4000-8000-000000000013'
        ruta = alumno + '/certificado.pdf'
        pdf = b'%PDF-1.4 certificado ficticio para prueba de recuperacion'
        sql(db, f"""
          insert into public.profiles(id,rol,nombre,email) values
            ('{coach}','coach','Profe ficticio','coach@backup.test'),
            ('{alumno_user}','alumno','Alumno ficticio','alumno@backup.test');
          insert into public.alumnos(id,coach_id,user_id,nombre) values ('{alumno}','{coach}','{alumno_user}','Alumno ficticio');
          insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas) values ('{plan}','{alumno}','Plan ficticio',current_date,6);
          insert into public.sesiones(id,plan_id,tipo,nombre,dia) values ('{sesion}','{plan}','Fuerza','Dia de prueba',1);
          insert into public.sesion_ejercicios(id,sesion_id,nombre) values ('{ejercicio}','{sesion}','Zumo');
          update public.ejercicio_semanas set prescripcion='4x8',peso='12.5',peso_fecha=current_date where ejercicio_id='{ejercicio}' and semana=1;
          insert into public.horarios_clase(coach_id,titulo,dia,hora,fin,lugar) values ('{coach}','Clase ficticia',1,'16:00','19:00','Palmar ficticio');
          update public.fichas_medicas set cert_ruta='{ruta}',cert_nombre='certificado.pdf',cert_tipo='application/pdf',cert_tamano={len(pdf)} where alumno_id='{alumno}';
        """)
        pedir('/storage/v1/object/certificados/' + ruta, contenido=pdf, mime='application/pdf')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            archivo = root/'database.dump'
            descargar_postgres(db + '?sslmode=disable', archivo)
            counts = preparar_datos(archivo, root)
            assert counts['auth.users'] == 2 and counts['auth.identities'] == 2
            assert counts['public.ejercicio_semanas'] == 6
            storage = respaldar_storage(api, key, root)
            assert len(storage['objects']) == 1
            files = [{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
                     for p in (archivo,root/'auth-data.sql',root/'public-data.sql')]
            manifest = {**storage,'files':files,'counts':counts,'created_at_utc':datetime.now(timezone.utc).isoformat()}
            (root/'manifest.json').write_text(json.dumps(manifest))
            verificar(root, manifest)
            print('OK: snapshot de migraciones reales, Auth, plan de 6 semanas y certificado privado.', flush=True)
            pedir('/storage/v1/object/certificados', {'prefixes':[ruta]}, method='DELETE')
            sql(db, """do $$ declare tablas text; begin
                select string_agg(format('%I.%I',schemaname,tablename),',') into tablas from pg_tables where schemaname='public';
                execute 'truncate table '||tablas||' cascade';
              end $$; delete from auth.users;""")
            with patch.dict(os.environ, {'LOCAL_SUPABASE_DB_URL':db,'LOCAL_SUPABASE_URL':api,'LOCAL_SUPABASE_SERVICE_ROLE_KEY':key}), \
                 patch('sys.argv',['restore_drill.py',str(root)]):
                restaurar()
            token = json.loads(pedir('/auth/v1/token?grant_type=password', {'email':'alumno@backup.test','password':password}))
            assert token['user']['id'] == alumno_user
            assert pedir('/storage/v1/object/certificados/' + ruta, method='GET') == pdf
            assert sql(db, 'select peso from public.ejercicio_semanas where semana=1;') == '12.5'
            cifrado = root/'backup.gpg'
            subprocess.run(['gpg','--batch','--yes','--pinentry-mode','loopback','--passphrase-fd','0','--symmetric','--cipher-algo','AES256','--output',str(cifrado),str(archivo)], input=b'clave-ficticia',check=True,capture_output=True)
            descifrado = subprocess.run(['gpg','--batch','--quiet','--pinentry-mode','loopback','--passphrase-fd','0','--decrypt',str(cifrado)],input=b'clave-ficticia',check=True,capture_output=True)
            assert descifrado.stdout == archivo.read_bytes()
            print('OK: restauración completa en Supabase real local; login con clave original, IDs, pesos, FKs, PDF y GPG verificados.', flush=True)
    finally:
        proxy.shutdown(); proxy.server_close(); hilo.join()


if __name__ == '__main__': main()
