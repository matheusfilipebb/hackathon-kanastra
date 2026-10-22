import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SituacaoCadastralRepository } from '../src/repositories/situacao-cadastral.repository.js';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import { validarSituacaoCadastralSacado } from '../src/validators/individuais/situacao-cadastral-sacado.validator.js';

const configuracao = async (): Promise<ConfiguracaoValidadores> => JSON.parse(
  await readFile(new URL('../data/validadores_antecipe.json', import.meta.url), 'utf-8'),
);

test('repository indexa todos os registros de um CSV conhecido sem depender do cadastro editável', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'antecipe-cadastro-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'cadastro.csv');
  await writeFile(path, 'DOC;SITUACAO_CADASTRAL\n11.222.333/0001-81;ATIVA\n04252011000110;BAIXADA\n00.000.000/0001-91;SUSPENSA\n');
  const situacoes = await new SituacaoCadastralRepository(path).getAll();
  assert.deepEqual([...situacoes], [
    ['11222333000181', 'ATIVA'], ['04252011000110', 'BAIXADA'], ['00000000000191', 'SUSPENSA'],
  ]);
});

test('valida situações configuradas, máscara e CNPJs ausentes ou inválidos', () => {
  const situacoes = new Map([['11222333000181', 'ATIVA'], ['04252011000110', 'BAIXADA']]);
  for (const documento of ['11222333000181', '11.222.333/0001-81']) {
    assert.equal(validarSituacaoCadastralSacado(documento, situacoes, ['ATIVA']), true);
  }
  assert.equal(validarSituacaoCadastralSacado('04.252.011/0001-10', situacoes, ['ATIVA']), false);
  assert.equal(validarSituacaoCadastralSacado('04.252.011/0001-10', situacoes, ['BAIXADA']), true);
  for (const documento of ['00000000000191', 'inválido', null, undefined, 11222333000181]) {
    assert.equal(validarSituacaoCadastralSacado(documento, situacoes, ['ATIVA']), false);
  }
});

test('carrega uma vez por execução, consulta em memória e recarrega somente na próxima execução', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'antecipe-cadastro-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const csvPath = join(directory, 'cadastro.csv');
  await writeFile(csvPath, '\uFEFFDOC;SITUACAO_CADASTRAL\r\n11.222.333/0001-81;ATIVA\r\n');
  const repository = new SituacaoCadastralRepository(csvPath);
  const leitura = t.mock.method(repository, 'getAll');
  const config = await configuracao();
  const validadoresService = new ValidadoresService();
  t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService, repository);

  const primeira = await service.iniciarExecucao();
  for (let index = 0; index < 1000; index++) {
    assert.equal(primeira.validarSituacaoCadastralSacado('11222333000181'), true);
  }
  assert.equal(leitura.mock.callCount(), 1);

  await writeFile(csvPath, 'DOC;SITUACAO_CADASTRAL\n11.222.333/0001-81;BAIXADA\n');
  assert.equal(primeira.validarSituacaoCadastralSacado('11222333000181'), true);
  const segunda = await service.iniciarExecucao();
  assert.equal(segunda.validarSituacaoCadastralSacado('11222333000181'), false);
  assert.equal(leitura.mock.callCount(), 2);

  config.validadores.find(regra => regra.codigo === 'SITUACAO_CADASTRAL_SACADO')!.parametros.situacoes_aceitas = ['BAIXADA'];
  const terceira = await service.iniciarExecucao();
  assert.equal(terceira.validarSituacaoCadastralSacado('11222333000181'), true);
  assert.equal(segunda.validarSituacaoCadastralSacado('11222333000181'), false);
  assert.equal(primeira.validarSituacaoCadastralSacado('11222333000181'), true);
  assert.equal(leitura.mock.callCount(), 3);
});

test('regra inativa ou ausente não carrega o cadastro nem barra a nota', async t => {
  const repository = new SituacaoCadastralRepository('/arquivo-inexistente.csv');
  const leitura = t.mock.method(repository, 'getAll');
  const config = await configuracao();
  const regra = config.validadores.find(item => item.codigo === 'SITUACAO_CADASTRAL_SACADO')!;
  regra.ativo = false;
  const validadoresService = new ValidadoresService();
  t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService, repository);
  assert.equal((await service.iniciarExecucao()).validarSituacaoCadastralSacado('11222333000181'), true);
  config.validadores = config.validadores.filter(item => item !== regra);
  assert.equal((await service.iniciarExecucao()).validarSituacaoCadastralSacado('11222333000181'), true);
  assert.equal(leitura.mock.callCount(), 0);
});

test('repository rejeita cabeçalhos incorretos, registros incompletos e CNPJs duplicados', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'antecipe-cadastro-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'cadastro.csv');
  for (const content of [
    'CNPJ;STATUS\n11222333000181;ATIVA',
    'DOC;SITUACAO_CADASTRAL\n11222333000181;',
    'DOC;SITUACAO_CADASTRAL\n11222333000181;ATIVA\n11.222.333/0001-81;BAIXADA',
  ]) {
    await writeFile(path, content);
    await assert.rejects(new SituacaoCadastralRepository(path).getAll());
  }
});
