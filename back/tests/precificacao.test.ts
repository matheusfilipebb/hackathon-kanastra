import assert from 'node:assert/strict';
import test from 'node:test';
import { PrecificacaoService, PrecificacaoError } from '../src/services/precificacao.service.js';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import type { RecebivelCsv } from '../src/types/recebivel-csv.js';

const configuracao = (taxa = 2, base = 30): ConfiguracaoValidadores['precificacao'] => ({
  metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: taxa, base_dias: base,
});
const dados = (valor = '1000,00', aquisicao = '01/01/2026', vencimento = '02/03/2026') => ({
  VALOR_NOMINAL: valor, DATA_AQUISICAO: aquisicao, DATA_VENCIMENTO_ORIGINAL: vencimento,
});

test('desconto simples usa taxa mensal e base configuradas sobre o prazo entre aquisição e vencimento', () => {
  assert.deepEqual(new PrecificacaoService(configuracao()).calcular(dados()), {
    metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30,
    prazo_dias: 60, valor_nominal: 1000, valor_desconto: 40, valor_liquido: 960,
  });
  const outraBase = new PrecificacaoService(configuracao(3, 10)).calcular(dados('1000,00', '01/01/2026', '16/01/2026'));
  assert.equal(outraBase.prazo_dias, 15);
  assert.equal(outraBase.valor_desconto, 45);
  assert.equal(outraBase.valor_liquido, 955);
});

test('arredonda desconto uma vez para centavos e mantém nominal igual a desconto mais líquido', () => {
  const service = new PrecificacaoService(configuracao());
  const meioCentavo = service.calcular(dados('0,25', '01/01/2026', '31/01/2026'));
  assert.equal(meioCentavo.valor_desconto, 0.01);
  assert.equal(meioCentavo.valor_liquido, 0.24);
  const fracionario = service.calcular(dados('1.234,56', '01/01/2026', '17/01/2026'));
  assert.equal(fracionario.valor_desconto, 13.17);
  assert.equal(fracionario.valor_liquido, 1221.39);
  assert.equal(Math.round((fracionario.valor_desconto + fracionario.valor_liquido) * 100), 123456);
});

test('trata taxa zero, prazo zero, ano bissexto e desconto igual ao nominal', () => {
  assert.equal(new PrecificacaoService(configuracao(0)).calcular(dados()).valor_liquido, 1000);
  assert.equal(new PrecificacaoService(configuracao()).calcular(dados('1000,00', '01/01/2026', '01/01/2026')).valor_desconto, 0);
  assert.equal(new PrecificacaoService(configuracao()).calcular(dados('1000,00', '28/02/2024', '01/03/2024')).prazo_dias, 2);
  assert.equal(new PrecificacaoService(configuracao(100)).calcular(dados('1000,00', '01/01/2026', '31/01/2026')).valor_liquido, 0);
  assert.equal(new PrecificacaoService(configuracao(1e-7)).calcular(dados()).valor_desconto, 0);
});

test('rejeita dados e configurações que não permitem uma cotação válida', () => {
  for (const [taxa, base] of [[-1, 30], [NaN, 30], [Infinity, 30], [2, 0], [2, -1], [2, 1.5]]) {
    assert.throws(() => new PrecificacaoService(configuracao(taxa, base)), PrecificacaoError);
  }
  assert.throws(() => new PrecificacaoService({ ...configuracao(), metodo: 'OUTRO' } as unknown as ConfiguracaoValidadores['precificacao']), PrecificacaoError);
  const service = new PrecificacaoService(configuracao());
  for (const entrada of [dados('inválido'), dados('-1,00'), dados('1000,00', '31/02/2026'),
    dados('1000,00', '02/03/2026', '01/01/2026'), dados('9007199254740993,00')]) {
    assert.throws(() => service.calcular(entrada), PrecificacaoError);
  }
  assert.throws(() => new PrecificacaoService(configuracao(100)).calcular(dados()), /superior ao valor nominal/);
});

test('precifica somente após as concentrações, usando a mesma configuração da execução', async t => {
  const config: ConfiguracaoValidadores = {
    fundo: { nome: 'ANTECIPE', cnpj: '92.234.400/0001-80' },
    validadores: [{ codigo: 'CONCENTRACAO_MAXIMA_SACADO', ativo: true,
      parametros: { percentual_maximo: 10, agrupamento: 'RAIZ_CNPJ' } }],
    precificacao: configuracao(100, 1),
  };
  const validadores = new ValidadoresService();
  const leitura = t.mock.method(validadores, 'get', async () => config);
  const service = new AnaliseService(validadores);
  const nota: RecebivelCsv = { ...dados(), linha: 2, NOME_FUNDO: 'ANTECIPE', DOC_FUNDO: '92.234.400/0001-80',
    NOME_CEDENTE: 'CEDENTE', DOC_CEDENTE: '11.222.333/0001-81', NOME_SACADO: 'SACADO',
    DOC_SACADO: '11.222.333/0001-81', NU_DOCUMENTO: '0001', TIPO_RECEBIVEL: 'Duplicata' };
  const barrada = await service.analisarRecebiveis([nota]);
  assert.deepEqual(barrada, [{ linha: 2, id: '0001', status: 'BARRADO', barrado_por: ['CONCENTRACAO_MAXIMA_SACADO'] }]);
  config.validadores = [];
  config.precificacao = configuracao();
  const execucao = await service.iniciarExecucao();
  config.precificacao.taxa_mensal_percentual = 4;
  assert.equal(execucao.precificarRecebivel(nota).valor_liquido, 960);
  assert.equal((await service.analisarRecebiveis([nota]))[0].precificacao?.valor_liquido, 920);
  assert.equal(leitura.mock.callCount(), 3);
});
