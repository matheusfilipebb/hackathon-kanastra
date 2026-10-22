import type { RecebivelAnalisado } from '../../types/recebivel-analisado.js';
import { validarConcentracaoMaxima } from './concentracao-maxima.validator.js';

export function validarConcentracaoMaximaSacado<T extends RecebivelAnalisado>(
  recebiveis: readonly T[], percentualMaximo: number,
): T[] {
  return validarConcentracaoMaxima(recebiveis, percentualMaximo, {
    codigo: 'CONCENTRACAO_MAXIMA_SACADO',
    obterDocumento: nota => nota.DOC_SACADO,
    agruparPorRaiz: true,
  });
}
