export function agruparPorFundo<T extends { DOC_FUNDO: string }>(recebiveis: readonly T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const recebivel of recebiveis) {
    const grupo = grupos.get(recebivel.DOC_FUNDO);
    if (grupo) {
      grupo.push(recebivel);
    } else {
      grupos.set(recebivel.DOC_FUNDO, [recebivel]);
    }
  }
  return grupos;
}
