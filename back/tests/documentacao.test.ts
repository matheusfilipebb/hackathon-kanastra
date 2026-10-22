import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Fastify from 'fastify';
import { registerDocumentation } from '../src/docs/swagger.js';
import { recebiveisRoutes } from '../src/routes/recebiveis.routes.js';
import { validadoresRoutes } from '../src/routes/validadores.routes.js';

test('Swagger documenta as três operações e preserva o upload multipart', async t => {
  const app = Fastify();
  t.after(() => app.close());
  await registerDocumentation(app);
  await app.register(recebiveisRoutes);
  await app.register(validadoresRoutes);

  const ui = await app.inject({ method: 'GET', url: '/docs/' });
  assert.equal(ui.statusCode, 200);
  assert.match(ui.headers['content-type']!, /text\/html/);
  const response = await app.inject({ method: 'GET', url: '/docs/json' });
  assert.equal(response.statusCode, 200);
  const spec = response.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.paths['/validadores'].get.responses['200']);
  assert.ok(spec.paths['/validadores'].put.responses['400']);
  assert.ok(spec.paths['/validadores'].put.requestBody.content['application/json'].example);
  const uploadSchema = spec.paths['/recebiveis/upload'].post.requestBody.content['multipart/form-data'].schema;
  assert.deepEqual(uploadSchema.required, ['file']);
  assert.equal(uploadSchema.properties.file.format, 'binary');
  assert.equal((await app.inject({ method: 'GET', url: '/docs/yaml' })).statusCode, 200);

  const config = JSON.parse(await readFile(new URL('../data/validadores_antecipe.json', import.meta.url), 'utf-8'));
  assert.deepEqual((await app.inject({ method: 'GET', url: '/validadores' })).json(), config);

  const csv = 'NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;'
    + 'NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO\n'
    + 'ANTECIPE;001;CEDENTE;002;SACADO;003;000123;Duplicata;100,00;23/10/2026;22/10/2026\n';
  const boundary = 'antecipe-docs-test';
  const upload = await app.inject({
    method: 'POST', url: '/recebiveis/upload',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notas.csv"\r\n`
      + `Content-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`,
  });
  assert.equal(upload.statusCode, 200);
  const expected = JSON.parse(await readFile(new URL('../data/resultado_esperado_100k.json', import.meta.url), 'utf-8'));
  assert.deepEqual(upload.json(), expected);
});
