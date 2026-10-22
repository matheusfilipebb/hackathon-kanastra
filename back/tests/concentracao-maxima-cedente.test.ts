import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { RecebivelAnalisadoCedente } from '../src/types/recebivel-analisado.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import { validarConcentracaoMaximaCedente } from '../src/validators/coletivos/concentracao-maxima-cedente.validator.js';

const A = '11.222.333/0001-81';
const B = '04.252.011/0001-10';
const C = '00.000.000/0001-91';
const codigo = 'CONCENTRACAO_MAXIMA_CEDENTE';

function nota(linha: number, cedente: string, valor: string | number, fundo = 'F1'): RecebivelAnalisadoCedente {
  return { linha, DOC_FUNDO: fundo, DOC_CEDENTE: cedente, VALOR_NOMINAL: valor, status: 'APROVADO' };
}
const barradas = (notas: RecebivelAnalisadoCedente[]) => notas.filter(nota => nota.status === 'BARRADO').map(nota => nota.linha);

test('agrupa o mesmo cedente com e sem máscara e exclui rejeições anteriores', () => {
  const entrada = [nota(2, A, 400), nota(3, B, 300), nota(4, '11222333000181', 300), {
    ...nota(5, C, 10000), status: 'BARRADO' as const, barrado_por: ['VALOR_MINIMO'],
  }];
  const original = structuredClone(entrada);
  const resultado = validarConcentracaoMaximaCedente(entrada, 60);
  assert.deepEqual(barradas(resultado), [4, 5]);
  assert.deepEqual(resultado[2].barrado_por, [codigo]);
  assert.deepEqual(resultado[3], entrada[3]);
  assert.deepEqual(entrada, original);
  assert.deepEqual(resultado.map(nota => nota.linha), [2, 3, 4, 5]);
});

test('cedentes com a mesma raiz e CNPJs completos distintos não são somados', () => {
  const entrada = [nota(2, A, 400), nota(3, '11222333000262', 300), nota(4, B, 300)];
  assert.deepEqual(barradas(validarConcentracaoMaximaCedente(entrada, 60)), []);
});

test('separa os fundos e retira pela maior linha, preservando a ordem da entrada', () => {
  const entrada = [nota(20, A, 300), nota(3, A, 400, 'F2'), nota(2, A, 400), nota(7, B, 300), nota(8, B, 600, 'F2')];
  const resultado = validarConcentracaoMaximaCedente(entrada, 60);
  assert.deepEqual(barradas(resultado), [20]);
  assert.deepEqual(resultado.map(nota => nota.linha), [20, 3, 2, 7, 8]);
});

test('recalcula os totais e revisita cedentes que excedem o limite após retiradas', () => {
  const entrada = [nota(2, A, 300), nota(3, B, 300), nota(4, A, 150), nota(5, B, 300), nota(6, C, 100)];
  const resultado = validarConcentracaoMaximaCedente(entrada, 50);
  assert.deepEqual(barradas(resultado), [4, 5]);
  assert.deepEqual(resultado.filter(nota => nota.status === 'APROVADO').map(nota => nota.linha), [2, 3, 6]);
});

test('respeita centavos, percentuais fracionários e fundos vazios ou com total zero', () => {
  const entrada = [nota(2, A, '0,01'), nota(3, B, '0,01'), nota(4, A, '0,01')];
  assert.deepEqual(barradas(validarConcentracaoMaximaCedente(entrada, 66.66666666666666)), [4]);
  assert.deepEqual(validarConcentracaoMaximaCedente([], 8), []);
  assert.deepEqual(barradas(validarConcentracaoMaximaCedente([nota(2, A, 0)], 0)), []);
  assert.deepEqual(barradas(validarConcentracaoMaximaCedente([nota(2, A, 100)], 8)), [2]);
});

test('usa o percentual da execução e não altera notas quando a regra está inativa ou ausente', async t => {
  const config: ConfiguracaoValidadores = {
    fundo: { nome: 'ANTECIPE', cnpj: '92.234.400/0001-80' },
    validadores: [{ codigo, ativo: true, parametros: { percentual_maximo: 60 } }],
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 },
  };
  const validadoresService = new ValidadoresService();
  t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService);
  const entrada = [nota(2, A, 400), nota(3, B, 300), nota(4, A, 300)];
  const primeira = await service.iniciarExecucao();
  config.validadores[0].parametros.percentual_maximo = 90;
  const segunda = await service.iniciarExecucao();
  assert.deepEqual(barradas(primeira.validarConcentracaoMaximaCedente(entrada)), [4]);
  assert.deepEqual(barradas(segunda.validarConcentracaoMaximaCedente(entrada)), []);
  config.validadores[0].ativo = false;
  assert.deepEqual((await service.iniciarExecucao()).validarConcentracaoMaximaCedente(entrada), entrada);
  config.validadores = [];
  assert.deepEqual((await service.iniciarExecucao()).validarConcentracaoMaximaCedente(entrada), entrada);
});
