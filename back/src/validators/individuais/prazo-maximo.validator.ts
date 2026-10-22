import { calcularPrazoDias } from '../../utils/datas.js';

export function validarPrazoMaximo(vencimento: unknown, referencia: unknown, prazoMaximoDias: number): boolean {
  if (!Number.isSafeInteger(prazoMaximoDias) || prazoMaximoDias < 0) return false;
  const dias = calcularPrazoDias(vencimento, referencia);
  return dias !== null && dias <= prazoMaximoDias;
}
