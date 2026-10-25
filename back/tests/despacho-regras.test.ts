import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import { parseRecebiveisCsv } from '../src/utils/parse-recebiveis-csv.js';

test('despacho não executa propriedades herdadas mesmo em um JSON legado editado fora do PUT', async t => {
  const config: ConfiguracaoValidadores = {
    fundo: { nome: 'TESTE', cnpj: '000' },
    validadores: ['__proto__', 'constructor', 'toString'].map(codigo => ({ codigo, ativo: true, parametros: {} })),
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 },
  };
  const service = new ValidadoresService();
  t.mock.method(service, 'get', async () => config);
  const rows = parseRecebiveisCsv('NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO\nFUNDO;001;CEDENTE;002;SACADO;003;NF;Duplicata;1000,00;30/10/2026;01/10/2026');
  await assert.rejects(new AnaliseService(service).analisarRecebiveis(rows), /código de validador não suportado/);
});
