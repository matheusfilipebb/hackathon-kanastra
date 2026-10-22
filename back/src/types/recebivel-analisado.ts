export interface RecebivelAnalisado {
  linha: number;
  DOC_FUNDO: string;
  DOC_SACADO: string;
  VALOR_NOMINAL: string | number;
  status: 'APROVADO' | 'BARRADO';
  barrado_por?: string[];
}
