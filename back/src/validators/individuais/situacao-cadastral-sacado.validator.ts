export function validarSituacaoCadastralSacado(
  documento: unknown,
  situacoes: ReadonlyMap<string, string>,
  situacoesAceitas: readonly string[],
): boolean {
  if (typeof documento !== 'string') return false;
  const valor = documento.trim();
  if (!/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(valor)) return false;

  const situacao = situacoes.get(valor.replace(/[./-]/g, ''));
  return situacao !== undefined && situacoesAceitas.includes(situacao);
}
