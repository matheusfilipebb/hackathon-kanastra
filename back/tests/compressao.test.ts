import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import Fastify from 'fastify';
import { registerResponseCompression } from '../src/plugins-compression.js';
import { recebiveisRoutes } from '../src/routes/recebiveis.routes.js';

test('upload negocia gzip e mantém os resultados completos após descompactar', async t => {
  const server = Fastify();
  t.after(() => server.close());
  await registerResponseCompression(server);
  await server.register(recebiveisRoutes);
  const header = 'NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO';
  const csv = header + '\n' + Array.from({ length: 2000 }, (_, i) =>
    `ANTECIPE;001;CEDENTE;002;SACADO;003;NF-${i};Duplicata;100,00;23/10/2026;22/10/2026`).join('\n');
  const boundary = 'compression-test';
  const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notas.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;
  const upload = (encoding?: string) => server.inject({
    method: 'POST', url: '/recebiveis/upload', payload,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, ...(encoding ? { 'accept-encoding': encoding } : {}) },
  });
  const plain = await upload();
  const compressed = await upload('gzip');
  assert.equal(plain.statusCode, 200);
  assert.equal(compressed.statusCode, 200);
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.equal(compressed.headers['content-encoding'], 'gzip');
  assert.match(String(compressed.headers.vary), /accept-encoding/i);
  const decoded = JSON.parse(gunzipSync(compressed.rawPayload).toString());
  assert.deepEqual(decoded, plain.json());
  assert.equal(decoded.length, 2000);
  assert.ok(compressed.rawPayload.length < plain.rawPayload.length / 2);
  t.diagnostic(`JSON: ${plain.rawPayload.length} bytes; gzip: ${compressed.rawPayload.length} bytes`);
});

test('respostas pequenas e clientes sem gzip continuam compatíveis', async t => {
  const server = Fastify();
  t.after(() => server.close());
  await registerResponseCompression(server);
  server.get('/small', () => ({ ok: true }));
  server.get('/large', () => ({ value: 'nota fiscal '.repeat(1000) }));
  const small = await server.inject({ url: '/small', headers: { 'accept-encoding': 'gzip' } });
  assert.equal(small.headers['content-encoding'], undefined);
  assert.deepEqual(small.json(), { ok: true });
  const identity = await server.inject({ url: '/large', headers: { 'accept-encoding': 'identity' } });
  assert.equal(identity.headers['content-encoding'], undefined);
  assert.equal(identity.json().value, 'nota fiscal '.repeat(1000));
});
