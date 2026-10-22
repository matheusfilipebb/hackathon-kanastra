import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import { calcularPrazoDias } from '../src/utils/datas.js';
import { validarValorMinimo } from '../src/validators/individuais/valor-minimo.validator.js';
import { validarNaoVencida } from '../src/validators/individuais/nao-vencida.validator.js';
import { validarPrazoMaximo } from '../src/validators/individuais/prazo-maximo.validator.js';
import { validarPrazoMinimo } from '../src/validators/individuais/prazo-minimo.validator.js';

function configuracao(): ConfiguracaoValidadores {
  return {
    fundo: { nome: 'ANTECIPE FIDC', cnpj: '92.234.400/0001-80' },
    validadores: [
      { codigo: 'VALOR_MINIMO', ativo: true, parametros: { valor_minimo: 100 } },
      { codigo: 'NAO_VENCIDA', ativo: true, parametros: {} },
      { codigo: 'PRAZO_MAXIMO', ativo: true, parametros: { prazo_maximo_dias: 180 } },
      { codigo: 'PRAZO_MINIMO', ativo: true, parametros: { prazo_minimo_dias: 30 } },
    ],
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 },
  };
}

test('VALOR_MINIMO aceita igualdade, números e valores CSV com vírgula', () => {
  for (const valor of [100, 100.01, '100', '100,00', '100,01', '1.234,56']) {
    assert.equal(validarValorMinimo(valor, 100), true, String(valor));
  }
  for (const valor of [99.99, '99,99', -1, '-1,00', '', '  ', null, undefined, NaN, Infinity, '100abc', '100.00', '1,234']) {
    assert.equal(validarValorMinimo(valor, 100), false, String(valor));
  }
  assert.equal(validarValorMinimo('0,00', 0), true);
  assert.equal(validarValorMinimo('0,09', 0.1), false);
  assert.equal(validarValorMinimo('0,10', 0.1), true);
  assert.equal(validarValorMinimo(100, -1), false);
});

test('NAO_VENCIDA aceita hoje e datas futuras e rejeita vencimentos anteriores', () => {
  assert.equal(validarNaoVencida('21/10/2026', '22/10/2026'), false);
  assert.equal(validarNaoVencida('22/10/2026', '22/10/2026'), true);
  assert.equal(validarNaoVencida('23/10/2026', '22/10/2026'), true);
});

test('prazos usam limites inclusivos, incluindo zero', () => {
  assert.equal(validarPrazoMaximo('30/06/2026', '01/01/2026', 180), true);
  assert.equal(validarPrazoMaximo('01/07/2026', '01/01/2026', 180), false);
  assert.equal(validarPrazoMinimo('30/01/2026', '01/01/2026', 30), false);
  assert.equal(validarPrazoMinimo('31/01/2026', '01/01/2026', 30), true);
  assert.equal(validarPrazoMinimo('01/02/2026', '01/01/2026', 30), true);
  assert.equal(validarPrazoMaximo('22/10/2026', '22/10/2026', 0), true);
  assert.equal(validarPrazoMinimo('22/10/2026', '22/10/2026', 0), true);
  assert.equal(validarPrazoMaximo('23/10/2026', '22/10/2026', 0), false);
  assert.equal(validarPrazoMinimo('21/10/2026', '22/10/2026', 0), false);
  // Vencimento anterior é responsabilidade de NAO_VENCIDA, não de PRAZO_MAXIMO.
  assert.equal(validarPrazoMaximo('21/10/2026', '22/10/2026', 180), true);
  for (const limite of [-1, 1.5, NaN, Infinity]) {
    assert.equal(validarPrazoMaximo('22/10/2026', '22/10/2026', limite), false);
    assert.equal(validarPrazoMinimo('22/10/2026', '22/10/2026', limite), false);
  }
});

test('datas respeitam anos bissextos e dias civis sem horário de verão', () => {
  assert.equal(calcularPrazoDias('01/03/2024', '28/02/2024'), 2);
  assert.equal(calcularPrazoDias('01/03/2026', '28/02/2026'), 1);
  assert.equal(calcularPrazoDias('05/11/2018', '03/11/2018'), 2);
  assert.equal(calcularPrazoDias('01/01/2027', '31/12/2026'), 1);
  assert.equal(calcularPrazoDias('29/02/2024', '01/03/2024'), -1);
  for (const data of ['', '31/04/2026', '29/02/2026', '00/01/2026', '01/13/2026', '01/01/0000', '2026-10-22', null, new Date()]) {
    assert.equal(validarNaoVencida(data, '22/10/2026'), false, String(data));
    assert.equal(validarNaoVencida('22/10/2026', data), false, String(data));
    assert.equal(validarPrazoMaximo(data, '22/10/2026', 180), false, String(data));
    assert.equal(validarPrazoMinimo('22/10/2026', data, 30), false, String(data));
  }
});

test('execução captura os parâmetros e a próxima execução incorpora alterações', async t => {
  const config = configuracao();
  const validadoresService = new ValidadoresService();
  const leitura = t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService);
  const primeira = await service.iniciarExecucao();
  assert.equal(primeira.validarValorMinimo('100,00'), true);
  assert.equal(primeira.validarValorMinimo('99,99'), false);
  assert.equal(primeira.validarNaoVencida('31/12/2025', '01/01/2026'), false);
  assert.equal(primeira.validarPrazoMaximo('30/06/2026', '01/01/2026'), true);
  assert.equal(primeira.validarPrazoMinimo('31/01/2026', '01/01/2026'), true);

  config.validadores[0].parametros.valor_minimo = 200;
  config.validadores[1].ativo = false;
  config.validadores[2].parametros.prazo_maximo_dias = 10;
  config.validadores[3].parametros.prazo_minimo_dias = 60;
  const segunda = await service.iniciarExecucao();
  assert.equal(segunda.validarValorMinimo('100,00'), false);
  assert.equal(segunda.validarNaoVencida('31/12/2025', '01/01/2026'), true);
  assert.equal(segunda.validarPrazoMaximo('30/06/2026', '01/01/2026'), false);
  assert.equal(segunda.validarPrazoMinimo('31/01/2026', '01/01/2026'), false);
  assert.equal(primeira.validarValorMinimo('100,00'), true);
  assert.equal(primeira.validarNaoVencida('31/12/2025', '01/01/2026'), false);
  assert.equal(primeira.validarPrazoMaximo('30/06/2026', '01/01/2026'), true);
  assert.equal(primeira.validarPrazoMinimo('31/01/2026', '01/01/2026'), true);
  assert.equal(leitura.mock.callCount(), 2);
});

test('regras inativas ou ausentes não barram nem exigem parâmetros', async t => {
  const config = configuracao();
  for (const regra of config.validadores) { regra.ativo = false; regra.parametros = {}; }
  const validadoresService = new ValidadoresService();
  t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService);
  for (const regras of [config.validadores, []]) {
    config.validadores = regras;
    const execucao = await service.iniciarExecucao();
    assert.equal(execucao.validarValorMinimo(null), true);
    assert.equal(execucao.validarNaoVencida(null, null), true);
    assert.equal(execucao.validarPrazoMaximo(null, null), true);
    assert.equal(execucao.validarPrazoMinimo(null, null), true);
  }
});

test('configuração ativa com limite ausente, negativo ou não numérico é rejeitada', async t => {
  const casos = [
    ['VALOR_MINIMO', 'valor_minimo', -1], ['VALOR_MINIMO', 'valor_minimo', undefined],
    ['VALOR_MINIMO', 'valor_minimo', '100'], ['VALOR_MINIMO', 'valor_minimo', Infinity],
    ['PRAZO_MAXIMO', 'prazo_maximo_dias', -1], ['PRAZO_MAXIMO', 'prazo_maximo_dias', 1.5],
    ['PRAZO_MINIMO', 'prazo_minimo_dias', -1], ['PRAZO_MINIMO', 'prazo_minimo_dias', null],
  ] as const;
  for (const [codigo, campo, valor] of casos) {
    const config = configuracao();
    config.validadores.find(regra => regra.codigo === codigo)!.parametros[campo] = valor;
    const validadoresService = new ValidadoresService();
    t.mock.method(validadoresService, 'get', async () => config);
    await assert.rejects(new AnaliseService(validadoresService).iniciarExecucao(), { message: new RegExp(codigo) });
  }
});
