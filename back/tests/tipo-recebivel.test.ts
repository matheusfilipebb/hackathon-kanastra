import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../src/types/validadores.js';
import { validarTipoRecebivel } from '../src/validators/individuais/tipo-recebivel.validator.js';

function configuracao(tipos: unknown = ['Duplicata', 'Duplicata de Serviço']): ConfiguracaoValidadores {
  return {
    fundo: { nome: 'ANTECIPE FIDC', cnpj: '92.234.400/0001-80' },
    validadores: [{ codigo: 'TIPO_RECEBIVEL', ativo: true, parametros: { tipos_aceitos: tipos } }],
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 },
  };
}

test('aceita somente os tipos presentes na lista configurada', () => {
  const tipos = ['Duplicata', 'Duplicata de Serviço'];
  for (const tipo of tipos) assert.equal(validarTipoRecebivel(tipo, tipos), true);
  for (const tipo of ['Cheque', 'CCB', 'Nota Comercial', 'Boleto', 'duplicata', '', null, undefined, 1]) {
    assert.equal(validarTipoRecebivel(tipo, tipos), false, String(tipo));
  }
  assert.equal(validarTipoRecebivel('Cheque', ['Cheque']), true);
  assert.equal(validarTipoRecebivel('CCB', ['CCB']), true);
  assert.equal(validarTipoRecebivel('Nota Comercial', ['Nota Comercial']), true);
});

test('a execução captura os tipos configurados e a próxima execução incorpora alterações', async t => {
  const config = configuracao();
  const validadoresService = new ValidadoresService();
  const leitura = t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService);
  const primeira = await service.iniciarExecucao();
  assert.equal(primeira.validarTipoRecebivel('Duplicata'), true);
  assert.equal(primeira.validarTipoRecebivel('CCB'), false);
  (config.validadores[0].parametros.tipos_aceitos as string[]).splice(0, 2, 'CCB');
  assert.equal(primeira.validarTipoRecebivel('Duplicata'), true);
  assert.equal(primeira.validarTipoRecebivel('CCB'), false);
  assert.equal(leitura.mock.callCount(), 1);
  const segunda = await service.iniciarExecucao();
  assert.equal(segunda.validarTipoRecebivel('CCB'), true);
  assert.equal(segunda.validarTipoRecebivel('Duplicata'), false);
  assert.equal(leitura.mock.callCount(), 2);
});

test('regra inativa ou ausente não barra pelo tipo', async t => {
  const config = configuracao();
  config.validadores[0].ativo = false;
  const validadoresService = new ValidadoresService();
  t.mock.method(validadoresService, 'get', async () => config);
  const service = new AnaliseService(validadoresService);
  assert.equal((await service.iniciarExecucao()).validarTipoRecebivel('CCB'), true);
  config.validadores = [];
  assert.equal((await service.iniciarExecucao()).validarTipoRecebivel('CCB'), true);
});

test('a execução rejeita configuração ativa com lista de tipos inválida', async t => {
  for (const tipos of [undefined, null, [], 'Duplicata', [1], ['']]) {
    const config = configuracao();
    config.validadores[0].parametros.tipos_aceitos = tipos;
    const validadoresService = new ValidadoresService();
    t.mock.method(validadoresService, 'get', async () => config);
    await assert.rejects(new AnaliseService(validadoresService).iniciarExecucao(), /TIPO_RECEBIVEL.tipos_aceitos/);
  }
});
