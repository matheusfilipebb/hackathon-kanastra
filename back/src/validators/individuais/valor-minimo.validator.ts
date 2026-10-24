export function validarValorMinimo(valorNominal: unknown, valorMinimo: number): boolean {
  if (!Number.isFinite(valorMinimo) || valorMinimo < 0) return false;
  let valor: number;
  if (typeof valorNominal === 'number') {
    valor = valorNominal;
  } else if (typeof valorNominal === 'string') {
    const texto = valorNominal.trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(texto)) return false;
    valor = Number(texto.replace(/\./g, '').replace(',', '.'));
  } else {
    return false;
  }
  return Number.isFinite(valor) && valor >= 0 && valor >= valorMinimo;
}
