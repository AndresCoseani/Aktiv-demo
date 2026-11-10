import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { disponible, esperarApi, puertoOcupado } from './dev.mjs';

test('espera una API que arranca tarde y detecta una API caída', async () => {
  let lista = false;
  const server = createServer((_req, res) => { res.writeHead(lista ? 200 : 503); res.end(); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await disponible(url), false);
    assert.equal(await puertoOcupado(port), true);
    setTimeout(() => { lista = true; }, 100);
    await esperarApi(url, () => true, 3000);
    assert.equal(await disponible(url), true);
    await assert.rejects(esperarApi(url, () => false), /se cerró/);
  } finally { await new Promise((r) => server.close(r)); }
  assert.equal(await disponible(url), false);
});
