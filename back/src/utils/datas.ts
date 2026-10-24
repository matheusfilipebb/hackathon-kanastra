function converterData(valor: unknown): number | null {
  if (typeof valor !== 'string') return null;
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!partes) return null;
  const [, diaTexto, mesTexto, anoTexto] = partes;
  const dia = Number(diaTexto);
  const mes = Number(mesTexto);
  const ano = Number(anoTexto);
  if (ano < 1) return null;

  const data = new Date(0);
  data.setUTCFullYear(ano, mes - 1, dia);
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null;
  }
  return data.getTime();
}

export function calcularPrazoDias(vencimento: unknown, referencia: unknown): number | null {
  const dataVencimento = converterData(vencimento);
  const dataReferencia = converterData(referencia);
  if (dataVencimento === null || dataReferencia === null) return null;
  return (dataVencimento - dataReferencia) / 86_400_000;
}
