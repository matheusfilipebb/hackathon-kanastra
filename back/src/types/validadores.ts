export interface ConfiguracaoValidadores {
  fundo: { nome: string; cnpj: string };
  validadores: Array<{
    codigo: string;
    ativo: boolean;
    parametros: Record<string, unknown>;
  }>;
  precificacao: {
    metodo: 'DESCONTO_SIMPLES';
    taxa_mensal_percentual: number;
    base_dias: number;
  };
}
