import { calcularPrazoDias } from '../../utils/datas.js';

export function validarNaoVencida(vencimento: unknown, referencia: unknown): boolean {
  const dias = calcularPrazoDias(vencimento, referencia);
  return dias !== null && dias >= 0;
}
