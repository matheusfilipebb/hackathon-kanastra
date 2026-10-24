import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { request as httpRequest } from 'node:http';
import { setImmediate } from 'node:timers/promises';
import { UploadLimitsService } from '../src/services/upload-limits.service.js';
import { recebiveisRoutes } from '../src/routes/recebiveis.routes.js';
import { AnaliseService } from '../src/services/analise.service.js';

const limits = { maxConcurrent: 1, requestsPerWindow: 10, windowSeconds: 60 };
const boundary = 'upload-limit-test';
const csv = 'NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO\nFUNDO;001;CEDENTE;002;SACADO;003;NF-1;Duplicata;100,00;30/10/2026;01/10/2026';
const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notas.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;

test('cota global repõe tokens com o tempo e liberação de vaga é idempotente', () => {
  let now = 0;
  const limiter = new UploadLimitsService({ ...limits, requestsPerWindow: 2 }, () => now);
  const first = limiter.acquire(); assert.ok('release' in first);
  first.release(); first.release();
  const second = limiter.acquire(); assert.ok('release' in second);
  second.release();
  const denied = limiter.acquire(); assert.ok('code' in denied); assert.equal(denied.code, 'UPLOAD_RATE_LIMIT'); assert.equal(denied.retryAfter, 30);
  now = 30000;
  assert.ok('release' in limiter.acquire());
});

test('rejeita excesso de frequência antes de validar o arquivo, mesmo trocando IPs informados', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(recebiveisRoutes, { uploadLimits: { ...limits, requestsPerWindow: 1, windowSeconds: 3600 } });
  assert.equal((await app.inject({ method: 'POST', url: '/recebiveis/upload' })).statusCode, 415);
  const result = await app.inject({ method: 'POST', url: '/recebiveis/upload', headers: { 'x-forwarded-for': '203.0.113.2', 'cf-connecting-ip': '203.0.113.3' } });
  assert.equal(result.statusCode, 429); assert.equal(result.json().code, 'UPLOAD_RATE_LIMIT'); assert.ok(Number(result.headers['retry-after']) > 0);
});

test('mantém vaga durante análise, recusa concorrente e libera após sucesso ou erro', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(recebiveisRoutes, { uploadLimits: limits });
  const original = AnaliseService.prototype.analisarRecebiveis;
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { finish = resolve; });
  AnaliseService.prototype.analisarRecebiveis = async () => { started(); await gate; return []; };
  t.after(() => { AnaliseService.prototype.analisarRecebiveis = original; });
  const upload = () => app.inject({ method: 'POST', url: '/recebiveis/upload', payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
  const first = upload().then(response => response);
  await entered;
  const concurrent = await upload(); assert.equal(concurrent.statusCode, 429); assert.equal(concurrent.json().code, 'UPLOAD_CONCURRENCY_LIMIT');
  finish(); assert.equal((await first).statusCode, 200);
  assert.equal((await upload()).statusCode, 200);
  AnaliseService.prototype.analisarRecebiveis = async () => { throw new Error('Falha controlada'); };
  assert.equal((await upload()).statusCode, 500);
  AnaliseService.prototype.analisarRecebiveis = async () => [];
  assert.equal((await upload()).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/recebiveis/upload', payload: payload.replace('NOME_FUNDO', 'CAMPO_INVALIDO'), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } })).statusCode, 400);
  assert.equal((await upload()).statusCode, 200);
});


test('upload interrompido durante recebimento libera vaga', async t => {
  const app = Fastify(); t.after(() => app.close());
  let signalStarted!: () => void;
  let signalAborted!: () => void;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const aborted = new Promise<void>(resolve => { signalAborted = resolve; });
  app.addHook('onRequest', async request => {
    if (request.headers['x-test-incomplete']) {
      request.raw.once('aborted', signalAborted);
      signalStarted();
    }
  });
  await app.register(recebiveisRoutes, { uploadLimits: limits });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const client = httpRequest({ host: '127.0.0.1', port: address.port, path: '/recebiveis/upload', method: 'POST', headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': 100000, 'x-test-incomplete': '1' } });
  client.on('error', () => {});
  t.after(() => client.destroy());
  client.write(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.csv"\r\n\r\nincompleto`);
  await started; await setImmediate();
  assert.equal((await app.inject({ method: 'POST', url: '/recebiveis/upload' })).statusCode, 429);
  client.destroy(); await aborted; await setImmediate();
  assert.equal((await app.inject({ method: 'POST', url: '/recebiveis/upload' })).statusCode, 415);
});
