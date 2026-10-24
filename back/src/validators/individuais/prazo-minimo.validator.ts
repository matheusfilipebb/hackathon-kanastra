import { calcularPrazoDias } from '../../utils/datas.js';

export function validarPrazoMinimo(vencimento: unknown, referencia: unknown, prazoMinimoDias: number): boolean {
  if (!Number.isSafeInteger(prazoMinimoDias) || prazoMinimoDias < 0) return false;
  const dias = calcularPrazoDias(vencimento, referencia);
  return dias !== null && dias >= prazoMinimoDias;
}
