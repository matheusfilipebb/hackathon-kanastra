import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { agruparPorFundo } from '../src/utils/agrupar-por-fundo.js';

test('agrupa fundos intercalados mantendo a ordem das linhas e notas repetidas', () => {
  const linhas = Object.freeze([
    { linha: 2, DOC_FUNDO: '92.234.400/0001-80', NOME_FUNDO: 'Fundo A', NU_DOCUMENTO: '0001' },
    { linha: 3, DOC_FUNDO: '11.222.333/0001-81', NOME_FUNDO: 'Fundo A', NU_DOCUMENTO: '0001' },
    { linha: 4, DOC_FUNDO: '92.234.400/0001-80', NOME_FUNDO: 'Fundo A atualizado', NU_DOCUMENTO: '0002' },
    { linha: 5, DOC_FUNDO: '11.222.333/0001-81', NOME_FUNDO: 'Fundo B', NU_DOCUMENTO: '0002' },
    { linha: 6, DOC_FUNDO: '92.234.400/0001-80', NOME_FUNDO: 'Fundo A', NU_DOCUMENTO: '0001' },
  ].map(linha => Object.freeze(linha)));
  const grupos = new AnaliseService().agruparPorFundo(linhas);
  assert.deepEqual([...grupos.keys()], ['92.234.400/0001-80', '11.222.333/0001-81']);
  assert.deepEqual(grupos.get('92.234.400/0001-80')!.map(nota => nota.linha), [2, 4, 6]);
  assert.deepEqual(grupos.get('11.222.333/0001-81')!.map(nota => nota.linha), [3, 5]);
  assert.equal([...grupos.values()].flat().length, linhas.length);
  assert.equal(grupos.get('92.234.400/0001-80')![0], linhas[0]);
  assert.equal(grupos.get('92.234.400/0001-80')![2], linhas[4]);
  assert.deepEqual(linhas.map(nota => nota.linha), [2, 3, 4, 5, 6]);
});

test('entrada vazia retorna mapa vazio', () => {
  assert.equal(agruparPorFundo([]).size, 0);
});
