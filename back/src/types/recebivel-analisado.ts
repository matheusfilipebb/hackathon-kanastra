export interface RecebivelAnalisadoBase {
  linha: number;
  DOC_FUNDO: string;
  VALOR_NOMINAL: string | number;
  status: 'APROVADO' | 'BARRADO';
  barrado_por?: string[];
}

export interface RecebivelAnalisado extends RecebivelAnalisadoBase {
  DOC_SACADO: string;
}

export interface RecebivelAnalisadoCedente extends RecebivelAnalisadoBase {
  DOC_CEDENTE: string;
}
