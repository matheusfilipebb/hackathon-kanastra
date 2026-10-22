export interface PrecificacaoSugerida {
  metodo: 'DESCONTO_SIMPLES';
  taxa_mensal_percentual: number;
  base_dias: number;
  prazo_dias: number;
  valor_nominal: number;
  valor_desconto: number;
  valor_liquido: number;
}
