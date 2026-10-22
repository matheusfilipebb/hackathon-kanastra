import type { PrecificacaoSugerida } from './precificacao.js';

export interface RecebivelCsv {
  linha: number;
  NOME_FUNDO: string;
  DOC_FUNDO: string;
  NOME_CEDENTE: string;
  DOC_CEDENTE: string;
  NOME_SACADO: string;
  DOC_SACADO: string;
  NU_DOCUMENTO: string;
  TIPO_RECEBIVEL: string;
  VALOR_NOMINAL: string;
  DATA_VENCIMENTO_ORIGINAL: string;
  DATA_AQUISICAO: string;
}

export interface ResultadoAnalise {
  linha: number;
  id: string;
  status: 'APROVADO' | 'BARRADO';
  barrado_por?: string[];
  precificacao?: PrecificacaoSugerida;
}
