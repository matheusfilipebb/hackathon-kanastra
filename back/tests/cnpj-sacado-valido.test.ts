import assert from 'node:assert/strict';
import test from 'node:test';
import { AnaliseService } from '../src/services/analise.service.js';
import { validarCnpjSacado } from '../src/validators/individuais/cnpj-sacado-valido.validator.js';

test('aceita CNPJs matematicamente válidos, com ou sem máscara e com zeros à esquerda', () => {
  for (const documento of [
    '11.222.333/0001-81', '11222333000181',
    '04.252.011/0001-10', '04252011000110',
    '00.000.000/0001-91', '00000000000191',
    ' 11.222.333/0001-81 ',
  ]) {
    assert.equal(validarCnpjSacado(documento), true, documento);
  }
});

test('rejeita alterações em qualquer posição do CNPJ, incluindo os dois verificadores', () => {
  const documento = '11222333000181';
  for (let index = 0; index < documento.length; index++) {
    for (let digito = 0; digito <= 9; digito++) {
      if (String(digito) === documento[index]) continue;
      const alterado = documento.slice(0, index) + digito + documento.slice(index + 1);
      assert.equal(validarCnpjSacado(alterado), false, alterado);
    }
  }
});

test('rejeita sequências repetidas, quantidade incorreta de dígitos e caracteres inválidos', () => {
  const invalidos: unknown[] = [
    null, undefined, 11222333000181, {}, '', '   ',
    '1122233300018', '112223330001811',
    'AA.222.333/0001-81', '11-222-333/0001.81',
    '11.222.333/0001-81abc', '+11222333000181',
    '11 222333000181', '00.000.000/0000-00',
    ...Array.from({ length: 10 }, (_, digito) => String(digito).repeat(14)),
  ];
  for (const documento of invalidos) {
    assert.equal(validarCnpjSacado(documento), false, String(documento));
  }
});

test('o motor expõe a validação individual sem depender de leitura do arquivo ou de API', () => {
  const service = new AnaliseService();
  assert.equal(service.validarCnpjSacado('11.222.333/0001-81'), true);
  assert.equal(service.validarCnpjSacado('11.222.333/0001-82'), false);
});
