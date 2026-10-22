import type { RecebivelAnalisadoCedente } from '../../types/recebivel-analisado.js';
import { validarConcentracaoMaxima } from './concentracao-maxima.validator.js';

export function validarConcentracaoMaximaCedente<T extends RecebivelAnalisadoCedente>(
  recebiveis: readonly T[], percentualMaximo: number,
): T[] {
  return validarConcentracaoMaxima(recebiveis, percentualMaximo, {
    codigo: 'CONCENTRACAO_MAXIMA_CEDENTE',
    obterDocumento: nota => nota.DOC_CEDENTE,
    agruparPorRaiz: false,
  });
}
