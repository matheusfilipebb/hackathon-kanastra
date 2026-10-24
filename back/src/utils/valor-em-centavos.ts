export function valorEmCentavos(valor: string | number): bigint {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) throw new Error('Valor nominal inválido.');
    const texto = String(valor);
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) throw new Error('Valor nominal deve ter no máximo duas casas decimais.');
    const [inteiro, decimal = ''] = texto.split('.');
    return BigInt(inteiro) * 100n + BigInt(decimal.padEnd(2, '0'));
  }

  const texto = valor.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(texto)) {
    throw new Error('Valor nominal inválido; use o padrão decimal do CSV.');
  }
  const [inteiro, decimal = ''] = texto.replace(/\./g, '').split(',');
  return BigInt(inteiro) * 100n + BigInt(decimal.padEnd(2, '0'));
}
