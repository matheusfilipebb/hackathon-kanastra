import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import { ValidadoresRepository } from '../src/repositories/validadores.repository.js';
import { validadoresRoutes } from '../src/routes/validadores.routes.js';
import { ValidadoresService, ValidadoresValidationError } from '../src/services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';

const original = await readFile(new URL('../data/validadores_antecipe.json', import.meta.url), 'utf-8');
const configuracao = (): ConfiguracaoValidadores => JSON.parse(original);

function alterarParametro(codigo: string, campo: string, valor: unknown) {
  const config = configuracao();
  config.validadores.find(validador => validador.codigo === codigo)!.parametros[campo] = valor;
  return config;
}

test('service aceita zero nos limites e os cinco tipos, persistindo no repository', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'antecipe-validadores-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'validadores.json');
  await writeFile(path, original);
  const service = new ValidadoresService(new ValidadoresRepository(path));
  const config = configuracao();
  for (const validador of config.validadores) {
    for (const campo of ['valor_minimo', 'prazo_minimo_dias', 'prazo_maximo_dias', 'percentual_maximo']) {
      if (campo in validador.parametros) validador.parametros[campo] = 0;
    }
    if (validador.codigo === 'TIPO_RECEBIVEL') {
      validador.parametros.tipos_aceitos = ['Duplicata', 'Duplicata de Serviço', 'Cheque', 'CCB', 'Nota Comercial'];
    }
  }
  config.precificacao.taxa_mensal_percentual = 0;
  assert.deepEqual(await service.set(config), config);
  assert.deepEqual(await service.get(), config);
  assert.deepEqual(await new ValidadoresRepository(path).get(), config);
  assert.deepEqual(await readdir(directory), ['validadores.json']);
});

test('service rejeita parâmetros inválidos e preserva o arquivo anterior', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'antecipe-validadores-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'validadores.json');
  await writeFile(path, original);
  const service = new ValidadoresService(new ValidadoresRepository(path));
  const cases = [
    ['VALOR_MINIMO', 'valor_minimo', -1],
    ['VALOR_MINIMO', 'valor_minimo', '100'],
    ['VALOR_MINIMO', 'valor_minimo', null],
    ['VALOR_MINIMO', 'valor_minimo', undefined],
    ['VALOR_MINIMO', 'valor_minimo', NaN],
    ['VALOR_MINIMO', 'valor_minimo', Infinity],
    ['PRAZO_MINIMO', 'prazo_minimo_dias', -1],
    ['PRAZO_MAXIMO', 'prazo_maximo_dias', -1],
    ['PRAZO_MAXIMO', 'prazo_maximo_dias', 1.5],
    ['CONCENTRACAO_MAXIMA_SACADO', 'percentual_maximo', -1],
    ['CONCENTRACAO_MAXIMA_CEDENTE', 'percentual_maximo', -1],
    ['TIPO_RECEBIVEL', 'tipos_aceitos', ['Boleto']],
    ['TIPO_RECEBIVEL', 'tipos_aceitos', ['Duplicata', 'Inválido']],
    ['TIPO_RECEBIVEL', 'tipos_aceitos', [1]],
    ['TIPO_RECEBIVEL', 'tipos_aceitos', []],
    ['TIPO_RECEBIVEL', 'tipos_aceitos', 'Duplicata'],
  ] as const;
  for (const [codigo, campo, valor] of cases) {
    await assert.rejects(service.set(alterarParametro(codigo, campo, valor)), ValidadoresValidationError);
    assert.equal(await readFile(path, 'utf-8'), original);
  }
  const duplicate = configuracao();
  duplicate.validadores.push(duplicate.validadores[0]);
  await assert.rejects(service.set(duplicate), ValidadoresValidationError);
  for (const [campo, valor] of [['taxa_mensal_percentual', -1], ['base_dias', -1], ['base_dias', 0]] as const) {
    const config = configuracao();
    config.precificacao[campo] = valor;
    await assert.rejects(service.set(config), ValidadoresValidationError);
  }
  assert.equal(await readFile(path, 'utf-8'), original);
});

test('GET mantém o contrato e PUT retorna 400 com o motivo da validação do service', async t => {
  const app = Fastify();
  t.after(() => app.close());
  await app.register(validadoresRoutes);
  const get = await app.inject({ method: 'GET', url: '/validadores' });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.json(), configuracao());
  const put = await app.inject({
    method: 'PUT', url: '/validadores',
    payload: alterarParametro('VALOR_MINIMO', 'valor_minimo', -1),
  });
  assert.equal(put.statusCode, 400);
  assert.match(put.json().message, /VALOR_MINIMO.valor_minimo/);
  assert.equal(await readFile(new URL('../data/validadores_antecipe.json', import.meta.url), 'utf-8'), original);
});

test('rejeita configurações que antes eram salvas e quebravam a análise, inclusive regras inativas', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'antecipe-config-segura-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'validadores.json');
  await writeFile(path, original);
  const service = new ValidadoresService(new ValidadoresRepository(path));
  const invalidos: unknown[] = [null, [], {}, { ...configuracao(), validadores: null }];
  for (const codigo of ['__proto__', 'constructor', 'toString', 'REGRA_INEXISTENTE']) {
    invalidos.push({ ...configuracao(), validadores: [{ codigo, ativo: true, parametros: {} }] });
  }
  for (const ativo of [true, false]) {
    for (const [codigo, campo, valor] of [
      ['SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', undefined],
      ['SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', []],
      ['SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', ['']],
      ['SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', ['ATIVA', 'ATIVA']],
      ['SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', [' ATIVA']],
      ['SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', [123]],
      ['CONCENTRACAO_MAXIMA_SACADO', 'agrupamento', 'CNPJ_COMPLETO'],
      ['CONCENTRACAO_MAXIMA_SACADO', 'agrupamento', undefined],
      ['CONCENTRACAO_MAXIMA_SACADO', 'percentual_maximo', 100.01],
      ['CONCENTRACAO_MAXIMA_CEDENTE', 'percentual_maximo', 101],
      ['PRAZO_MAXIMO', 'prazo_maximo_dias', Number.MAX_SAFE_INTEGER + 1],
      ['VALOR_MINIMO', 'valor_minimo', Number.MAX_SAFE_INTEGER],
      ['TIPO_RECEBIVEL', 'tipos_aceitos', ['Duplicata', 'Duplicata']],
    ] as const) {
      const config = alterarParametro(codigo, campo, valor);
      config.validadores.find(regra => regra.codigo === codigo)!.ativo = ativo;
      invalidos.push(config);
    }
  }
  const prazos = configuracao();
  prazos.validadores.find(regra => regra.codigo === 'PRAZO_MINIMO')!.ativo = true;
  prazos.validadores.find(regra => regra.codigo === 'PRAZO_MINIMO')!.parametros.prazo_minimo_dias = 181;
  invalidos.push(prazos);
  invalidos.push({ ...configuracao(), precificacao: { metodo: 'INVALIDO', taxa_mensal_percentual: 2, base_dias: 30 } });
  invalidos.push({ ...configuracao(), precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: Infinity, base_dias: 30 } });
  invalidos.push(alterarParametro('VALOR_MINIMO', 'campo_errado', 1));
  for (const config of invalidos) {
    await assert.rejects(service.set(config as ConfiguracaoValidadores), ValidadoresValidationError);
    assert.equal(await readFile(path, 'utf-8'), original);
    assert.deepEqual(await readdir(directory), ['validadores.json']);
  }
});

test('PUT devolve 400 para códigos reservados, agrupamento e listas inválidas, preservando o arquivo', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(validadoresRoutes);
  const configs = [
    { ...configuracao(), validadores: [{ codigo: '__proto__', ativo: true, parametros: {} }] },
    alterarParametro('SITUACAO_CADASTRAL_SACADO', 'situacoes_aceitas', []),
    alterarParametro('CONCENTRACAO_MAXIMA_SACADO', 'agrupamento', 'INVALIDO'),
    alterarParametro('CONCENTRACAO_MAXIMA_CEDENTE', 'percentual_maximo', 101),
  ];
  for (const payload of configs) {
    const response = await app.inject({ method: 'PUT', url: '/validadores', payload });
    assert.equal(response.statusCode, 400); assert.ok(response.json().message);
    assert.deepEqual((await app.inject({ method: 'GET', url: '/validadores' })).json(), configuracao());
    assert.equal(await readFile(new URL('../data/validadores_antecipe.json', import.meta.url), 'utf-8'), original);
  }
});
