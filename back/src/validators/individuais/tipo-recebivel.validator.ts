export function validarTipoRecebivel(tipo: unknown, tiposAceitos: readonly string[]): boolean {
  return typeof tipo === 'string' && tiposAceitos.includes(tipo);
}
