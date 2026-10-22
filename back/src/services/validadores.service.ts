import { ValidadoresRepository } from '../repositories/validadores.repository.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

const tiposRecebiveis = new Set([
  'Duplicata', 'Duplicata de Serviço', 'Cheque', 'CCB', 'Nota Comercial',
]);

export class ValidadoresValidationError extends Error {}

function validarNumero(valor: unknown, campo: string, inteiro = false) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    throw new ValidadoresValidationError(`${campo} deve ser um número maior ou igual a zero.`);
  }
  if (inteiro && !Number.isInteger(valor)) {
    throw new ValidadoresValidationError(`${campo} deve ser um número inteiro de dias.`);
  }
}

export class ValidadoresService {
  constructor(private readonly repository = new ValidadoresRepository()) {}

  get() {
    return this.repository.get();
  }

  async set(configuracao: ConfiguracaoValidadores) {
    const codigos = new Set<string>();
    for (const { codigo, parametros } of configuracao.validadores) {
      if (codigos.has(codigo)) {
        throw new ValidadoresValidationError('Não é permitido repetir o código de um validador.');
      }
      codigos.add(codigo);

      // Valida também regras inativas para que possam ser ativadas com segurança.
      switch (codigo) {
        case 'VALOR_MINIMO':
          validarNumero(parametros.valor_minimo, `${codigo}.valor_minimo`);
          break;
        case 'PRAZO_MINIMO':
          validarNumero(parametros.prazo_minimo_dias, `${codigo}.prazo_minimo_dias`, true);
          break;
        case 'PRAZO_MAXIMO':
          validarNumero(parametros.prazo_maximo_dias, `${codigo}.prazo_maximo_dias`, true);
          break;
        case 'CONCENTRACAO_MAXIMA_SACADO':
        case 'CONCENTRACAO_MAXIMA_CEDENTE':
          validarNumero(parametros.percentual_maximo, `${codigo}.percentual_maximo`);
          break;
        case 'TIPO_RECEBIVEL': {
          const tipos = parametros.tipos_aceitos;
          if (!Array.isArray(tipos) || tipos.length === 0 || tipos.some(tipo => !tiposRecebiveis.has(tipo))) {
            throw new ValidadoresValidationError(
              'TIPO_RECEBIVEL.tipos_aceitos deve ser uma lista não vazia contendo apenas: '
              + [...tiposRecebiveis].join(', ') + '.',
            );
          }
          break;
        }
      }
    }

    validarNumero(configuracao.precificacao.taxa_mensal_percentual, 'precificacao.taxa_mensal_percentual');
    validarNumero(configuracao.precificacao.base_dias, 'precificacao.base_dias', true);
    if (configuracao.precificacao.base_dias === 0) {
      throw new ValidadoresValidationError('precificacao.base_dias deve ser maior que zero.');
    }

    return this.repository.set(configuracao);
  }
}
