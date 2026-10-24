import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { RecebivelAnalisado } from '../src/types/recebivel-analisado.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import { valorEmCentavos } from '../src/utils/valor-em-centavos.js';
import { validarConcentracaoMaximaSacado } from '../src/validators/coletivos/concentracao-maxima-sacado.validator.js';

const A = '11.222.333/0001-81';
const filialA = '11222333000262';
const B = '04.252.011/0001-10';
const C = '00.000.000/0001-91';
const codigo = 'CONCENTRACAO_MAXIMA_SACADO';

function nota(linha: number, sacado: string, valor: string | number, fundo = 'F1'): RecebivelAnalisado {
  return { linha, DOC_FUNDO: fundo, DOC_SACADO: sacado, VALOR_NOMINAL: valor, status: 'APROVADO' };
}
const barradas = (notas: RecebivelAnalisado[]) => notas.filter(nota => nota.status === 'BARRADO').map(nota => nota.linha);

test('agrupa filiais pela raiz e desconsidera notas já barradas nos dois totais', () => {
  const rejeitada = { ...nota(5, C, '10000,00'), status: 'BARRADO' as const, barrado_por: ['VALOR_MINIMO'] };
  const entrada = [nota(2, A, '400,00'), nota(3, B, '300,00'), nota(4, filialA, '300,00'), rejeitada];
  const copia = structuredClone(entrada);
  const resultado = validarConcentracaoMaximaSacado(entrada, 60);
  assert.deepEqual(barradas(resultado), [4, 5]);
  assert.deepEqual(resultado[2].barrado_por, [codigo]);
  assert.deepEqual(resultado[3], rejeitada);
  assert.deepEqual(entrada, copia);
  assert.deepEqual(resultado.map(nota => nota.linha), [2, 3, 4, 5]);
});

test('retira pela maior linha do sacado mesmo quando a entrada está fora de ordem', () => {
  const entrada = [nota(20, A, 300), nota(2, A, 400), nota(7, B, 300)];
  const resultado = validarConcentracaoMaximaSacado(entrada, 60);
  assert.deepEqual(barradas(resultado), [20]);
  assert.deepEqual(resultado.map(nota => nota.linha), [20, 2, 7]);
});

test('recalcula o fundo e revisita sacados que passam a exceder o limite', () => {
  const entrada = [nota(2, A, 300), nota(3, B, 300), nota(4, A, 150), nota(5, B, 300), nota(6, C, 100)];
  const resultado = validarConcentracaoMaximaSacado(entrada, 50);
  assert.deepEqual(barradas(resultado), [4, 5]);
  assert.deepEqual(resultado.filter(nota => nota.status === 'APROVADO').map(nota => nota.linha), [2, 3, 6]);
  const aprovadas = resultado.filter(nota => nota.status === 'APROVADO');
  const total = aprovadas.reduce((soma, nota) => soma + valorEmCentavos(nota.VALOR_NOMINAL), 0n);
  assert.equal(total, 70000n);
  for (const sacado of [A, B, C]) {
    const valor = aprovadas.filter(nota => nota.DOC_SACADO === sacado)
      .reduce((soma, nota) => soma + valorEmCentavos(nota.VALOR_NOMINAL), 0n);
    assert.ok(valor * 100n <= total * 50n);
  }
});

test('calcula cada fundo separadamente e preserva o limite exato', () => {
  const entrada = [nota(2, A, 400), nota(3, A, 400, 'F2'), nota(4, B, 300), nota(5, B, 600, 'F2'), nota(6, filialA, 300)];
  const resultado = validarConcentracaoMaximaSacado(entrada, 60);
  assert.deepEqual(barradas(resultado), [6]);
  assert.equal(resultado[1].status, 'APROVADO');
  assert.equal(resultado[3].status, 'APROVADO');
});

test('usa comparação exata em centavos e aceita percentuais fracionários', () => {
  assert.equal(valorEmCentavos('90.071.992.547.409,93'), 9007199254740993n);
  assert.equal(valorEmCentavos(0.1), 10n);
  const entrada = [nota(2, A, '0,01'), nota(3, B, '0,01'), nota(4, A, '0,01')];
  assert.deepEqual(barradas(validarConcentracaoMaximaSacado(entrada, 66.66666666666666)), [4]);
  assert.deepEqual(barradas(validarConcentracaoMaximaSacado(entrada, 66.66666666666667)), []);
});

test('trata fundo vazio, valores zero e remoção de todas as notas sem dividir por zero', () => {
  assert.deepEqual(validarConcentracaoMaximaSacado([], 10), []);
  const entrada = [nota(2, A, 0), nota(3, B, 100)];
  assert.deepEqual(barradas(validarConcentracaoMaximaSacado(entrada, 0)), [3]);
  assert.deepEqual(barradas(validarConcentracaoMaximaSacado(entrada, 1e-7)), [3]);
  assert.deepEqual(barradas(validarConcentracaoMaximaSacado(entrada, 100)), []);
  assert.deepEqual(barradas(validarConcentracaoMaximaSacado([nota(2, A, 100), nota(3, B, 100)], 10)), [2, 3]);
});

test('rejeita limites inválidos e dados aprovados insuficientes para calcular a concentração', () => {
  for (const percentual of [-1, NaN, Infinity]) {
    assert.throws(() => validarConcentracaoMaximaSacado([], percentual), /percentual_maximo/);
  }
  assert.throws(() => validarConcentracaoMaximaSacado([nota(2, 'inválido', 100)], 10), /CNPJ/);
  assert.throws(() => validarConcentracaoMaximaSacado([nota(2, A, '-1,00')], 10), /nominal/);
  assert.throws(() => validarConcentracaoMaximaSacado([nota(2, A, 100), nota(2, B, 100)], 10), /linhas/);
  assert.throws(() => validarConcentracaoMaximaSacado([nota(1, A, 100)], 10), /linhas/);
});

test('execução usa a configuração capturada e respeita regra inativa ou ausente', async t => {
  const config: ConfiguracaoValidadores = {
    fundo: { nome: 'ANTECIPE', cnpj: '92.234.400/0001-80' },
    validadores: [{ codigo, ativo: true, parametros: { percentual_maximo: 60, agrupamento: 'RAIZ_CNPJ' } }],
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 },
  };
  const validadoresService = new ValidadoresService();
  t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService);
  const entrada = [nota(2, A, 400), nota(3, B, 300), nota(4, A, 300)];
  const primeira = await service.iniciarExecucao();
  config.validadores[0].parametros.percentual_maximo = 90;
  const segunda = await service.iniciarExecucao();
  assert.deepEqual(barradas(primeira.validarConcentracaoMaximaSacado(entrada)), [4]);
  assert.deepEqual(barradas(segunda.validarConcentracaoMaximaSacado(entrada)), []);
  config.validadores[0].ativo = false;
  assert.deepEqual((await service.iniciarExecucao()).validarConcentracaoMaximaSacado(entrada), entrada);
  config.validadores = [];
  assert.deepEqual((await service.iniciarExecucao()).validarConcentracaoMaximaSacado(entrada), entrada);
});
