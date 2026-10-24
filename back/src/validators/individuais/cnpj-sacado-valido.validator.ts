function calcularDigito(numero: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, index) => total + Number(numero[index]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCnpjSacado(documento: unknown): boolean {
  if (typeof documento !== 'string') return false;

  const valor = documento.trim();
  if (!/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(valor)) return false;

  const cnpj = valor.replace(/[./-]/g, '');
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const primeiroDigito = calcularDigito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (primeiroDigito !== Number(cnpj[12])) return false;

  const segundoDigito = calcularDigito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return segundoDigito === Number(cnpj[13]);
}
