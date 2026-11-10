import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createConnection } from 'node:net';

const raiz = fileURLToPath(new URL('../', import.meta.url));
function envArchivo(ruta) {
  return existsSync(ruta) ? parseEnv(readFileSync(ruta, 'utf8')) : {};
}
export async function disponible(url) {
  try {
    const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}
export function puertoOcupado(puerto) {
  return new Promise((res) => {
    const socket = createConnection({ host: '127.0.0.1', port: puerto });
    const terminar = (ocupado) => { socket.destroy(); res(ocupado); };
    socket.once('connect', () => terminar(true));
    socket.once('error', () => terminar(false));
    socket.setTimeout(1000, () => terminar(false));
  });
}
export async function esperarApi(url, sigueVivo, limite = 120000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (!sigueVivo()) throw new Error('La API se cerró antes de arrancar. Revisá el error mostrado arriba.');
    if (await disponible(url)) return;
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error('La API no respondió en dos minutos. Revisá su configuración y dependencias.');
}

async function main() {
  const apiEnv = envArchivo(resolve(raiz, 'aktiv-api/.env'));
  const apiPuerto = Number(process.env.AKTIV_API_PORT ?? process.env.PORT ?? apiEnv.PORT ?? 4000);
  const clientePuerto = Number(process.env.AKTIV_CLIENT_PORT ?? 3000);
  for (const p of [apiPuerto, clientePuerto]) {
    if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error('Puerto local inválido.');
  }
  if (apiPuerto === clientePuerto) throw new Error('Cliente y API necesitan puertos diferentes.');
  const url = `http://127.0.0.1:${apiPuerto}`;
  const hijos = [];
  let cerrando = false;
  function cerrar(codigo = 0) {
    if (cerrando) return;
    cerrando = true;
    for (const hijo of hijos) {
      if (hijo.exitCode !== null) continue;
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else { try { process.kill(-hijo.pid, 'SIGTERM'); } catch { /* Ya se cerró. */ } }
    }
    process.exitCode = codigo;
  }
  process.once('SIGINT', () => cerrar());
  process.once('SIGTERM', () => cerrar());
  function iniciar(carpeta, comando, variables) {
    const windows = process.platform === 'win32';
    const hijo = spawn(windows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm', windows ? ['/d', '/s', '/c', `npm.cmd ${comando.join(' ')}`] : comando, {
      cwd: resolve(raiz, carpeta), env: { ...process.env, ...variables }, stdio: 'inherit', windowsHide: true, detached: !windows,
    });
    hijos.push(hijo);
    hijo.on('error', (e) => { console.error(`No se pudo iniciar ${carpeta}: ${e.message}`); cerrar(1); });
    hijo.on('exit', (codigo) => {
      if (!cerrando) { console.error(`${carpeta} se cerró (${codigo}). Se detuvo el entorno local.`); cerrar(codigo || 1); }
    });
    return hijo;
  }
  try {
    if (await puertoOcupado(clientePuerto)) throw new Error(`El puerto ${clientePuerto} ya está en uso. Cerrá tu cliente anterior o usá AKTIV_CLIENT_PORT.`);
    if (await disponible(url)) console.log(`API existente disponible en ${url}; se conserva su proceso.`);
    else {
      if (await puertoOcupado(apiPuerto)) throw new Error(`El puerto ${apiPuerto} está ocupado pero la API no responde. Revisá ese proceso antes de continuar.`);
      console.log(`Iniciando API en ${url}. Esperando compilación y health…`);
      const api = iniciar('aktiv-api', ['run', 'dev'], { PORT: String(apiPuerto), APP_URL: `http://localhost:${clientePuerto}` });
      await esperarApi(url, () => !cerrando && api.exitCode === null);
    }
    if (cerrando) return;
    console.log(`API lista. Iniciando cliente en http://localhost:${clientePuerto}`);
    iniciar('aktiv-client', ['run', 'dev:client', '--', '--port', String(clientePuerto)], { API_URL: url, PORT: String(clientePuerto) });
  } catch (e) { console.error(e.message); cerrar(1); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
