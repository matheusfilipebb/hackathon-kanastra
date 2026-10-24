import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import { SituacaoCadastralRepository } from '../src/repositories/situacao-cadastral.repository.js';
import { recebiveisRoutes } from '../src/routes/recebiveis.routes.js';
import { parseRecebiveisCsv } from '../src/utils/parse-recebiveis-csv.js';
import type { RecebivelCsv } from '../src/types/recebivel-csv.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';

const columns = ['NOME_FUNDO', 'DOC_FUNDO', 'NOME_CEDENTE', 'DOC_CEDENTE', 'NOME_SACADO', 'DOC_SACADO',
  'NU_DOCUMENTO', 'TIPO_RECEBIVEL', 'VALOR_NOMINAL', 'DATA_VENCIMENTO_ORIGINAL', 'DATA_AQUISICAO'] as const;
function nota(linha: number, campos: Partial<RecebivelCsv> = {}): RecebivelCsv {
  return {
    linha, NOME_FUNDO: 'ANTECIPE', DOC_FUNDO: '92.234.400/0001-80',
    NOME_CEDENTE: 'CEDENTE', DOC_CEDENTE: '11.222.333/0001-81', NOME_SACADO: 'SACADO',
    DOC_SACADO: '11.222.333/0001-81', NU_DOCUMENTO: `000${linha}`, TIPO_RECEBIVEL: 'Duplicata',
    VALOR_NOMINAL: '100,00', DATA_VENCIMENTO_ORIGINAL: '31/01/2026', DATA_AQUISICAO: '01/01/2026',
    ...campos,
  };
}
function config(validadores: ConfiguracaoValidadores['validadores']): ConfiguracaoValidadores {
  return { fundo: { nome: 'ANTECIPE', cnpj: '92.234.400/0001-80' }, validadores,
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 } };
}
function linhaCsv(nota: RecebivelCsv) {
  return columns.map(campo => `"${nota[campo].replace(/"/g, '""')}"`).join(';');
}

test('motor executa os sete individuais, acumula motivos e carrega cadastro e configuração uma vez', async t => {
  const configuracao = config([
    { codigo: 'CNPJ_SACADO_VALIDO', ativo: true, parametros: {} },
    { codigo: 'SITUACAO_CADASTRAL_SACADO', ativo: true, parametros: { situacoes_aceitas: ['ATIVA'] } },
    { codigo: 'TIPO_RECEBIVEL', ativo: true, parametros: { tipos_aceitos: ['Duplicata'] } },
    { codigo: 'VALOR_MINIMO', ativo: true, parametros: { valor_minimo: 100 } },
    { codigo: 'NAO_VENCIDA', ativo: true, parametros: {} },
    { codigo: 'PRAZO_MAXIMO', ativo: true, parametros: { prazo_maximo_dias: 180 } },
    { codigo: 'PRAZO_MINIMO', ativo: true, parametros: { prazo_minimo_dias: 30 } },
  ]);
  const validadores = new ValidadoresService();
  const cadastro = new SituacaoCadastralRepository();
  const leituraConfig = t.mock.method(validadores, 'get', async () => configuracao);
  const leituraCadastro = t.mock.method(cadastro, 'getAll', async () => new Map([
    ['11222333000181', 'ATIVA'], ['04252011000110', 'BAIXADA'],
  ]));
  const entrada = [nota(2), nota(3, { DOC_SACADO: 'inválido' }), nota(4, { DOC_SACADO: '04.252.011/0001-10' }),
    nota(5, { TIPO_RECEBIVEL: 'Cheque' }), nota(6, { VALOR_NOMINAL: '99,99' }),
    nota(7, { DATA_VENCIMENTO_ORIGINAL: '31/12/2025' }), nota(8, { DATA_VENCIMENTO_ORIGINAL: '01/07/2026' }),
    nota(9, { DATA_VENCIMENTO_ORIGINAL: '30/01/2026' })];
  const resultado = await new AnaliseService(validadores, cadastro).analisarRecebiveis(entrada);
  assert.deepEqual(resultado[0], { linha: 2, id: '0002', status: 'APROVADO' });
  assert.deepEqual(resultado.slice(1).map(nota => nota.barrado_por), [
    ['CNPJ_SACADO_VALIDO', 'SITUACAO_CADASTRAL_SACADO'], ['SITUACAO_CADASTRAL_SACADO'],
    ['TIPO_RECEBIVEL'], ['VALOR_MINIMO'], ['NAO_VENCIDA', 'PRAZO_MINIMO'], ['PRAZO_MAXIMO'], ['PRAZO_MINIMO'],
  ]);
  assert.equal(leituraConfig.mock.callCount(), 1);
  assert.equal(leituraCadastro.mock.callCount(), 1);
});

test('motor reavalia sacados após as retiradas pela concentração de cedente', async t => {
  const validadores = new ValidadoresService();
  t.mock.method(validadores, 'get', async () => config([
    { codigo: 'CONCENTRACAO_MAXIMA_SACADO', ativo: true, parametros: { percentual_maximo: 50, agrupamento: 'RAIZ_CNPJ' } },
    { codigo: 'CONCENTRACAO_MAXIMA_CEDENTE', ativo: true, parametros: { percentual_maximo: 60 } },
  ]));
  const resultado = await new AnaliseService(validadores).analisarRecebiveis([
    nota(2, { VALOR_NOMINAL: '400,00' }),
    nota(3, { DOC_SACADO: '04.252.011/0001-10', VALOR_NOMINAL: '300,00' }),
    nota(4, { DOC_SACADO: '00.000.000/0001-91', DOC_CEDENTE: '04.252.011/0001-10', VALOR_NOMINAL: '300,00' }),
  ]);
  assert.deepEqual(resultado.map(nota => nota.barrado_por), [
    ['CONCENTRACAO_MAXIMA_SACADO'], ['CONCENTRACAO_MAXIMA_CEDENTE'], ['CONCENTRACAO_MAXIMA_SACADO'],
  ]);
});

test('parser mantém as linhas físicas, campos multilinha, máscaras e zeros à esquerda', () => {
  const primeira = nota(2, { NOME_CEDENTE: 'CEDENTE\nLTDA', NOME_SACADO: 'SACADO "A"; TESTE' });
  const segunda = nota(5);
  const recebiveis = parseRecebiveisCsv(`\uFEFF${columns.join(';')}\r\n${linhaCsv(primeira)}\r\n\r\n${linhaCsv(segunda)}\r\n`);
  assert.deepEqual(recebiveis, [primeira, segunda]);
});

test('upload calcula apenas as notas enviadas e usa as alterações de configuração na próxima requisição', async t => {
  const configuracao = config([{ codigo: 'VALOR_MINIMO', ativo: true, parametros: { valor_minimo: 100 } }]);
  const leitura = t.mock.method(ValidadoresService.prototype, 'get', async () => configuracao);
  const app = Fastify();
  t.after(() => app.close());
  await app.register(recebiveisRoutes);
  const boundary = 'antecipe-integracao-test';
  const csv = `${columns.join(';')}\n${linhaCsv(nota(2))}\n`;
  const request = {
    method: 'POST' as const, url: '/recebiveis/upload',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notas.csv"\r\n`
      + `Content-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`,
  };
  const primeira = await app.inject(request);
  assert.equal(primeira.statusCode, 200);
  assert.deepEqual(primeira.json(), [{ linha: 2, id: '0002', status: 'APROVADO' }]);
  configuracao.validadores[0].parametros.valor_minimo = 101;
  const segunda = await app.inject(request);
  assert.equal(segunda.statusCode, 200);
  assert.deepEqual(segunda.json(), [{ linha: 2, id: '0002', status: 'BARRADO', barrado_por: ['VALOR_MINIMO'] }]);
  assert.equal(leitura.mock.callCount(), 2);
});
