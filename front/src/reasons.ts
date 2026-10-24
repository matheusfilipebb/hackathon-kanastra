const explanations: Record<string, string> = {
  CNPJ_SACADO_VALIDO: 'O CNPJ informado para o sacado não passou na validação cadastral.',
  SITUACAO_CADASTRAL_SACADO: 'A situação cadastral do sacado não está entre as situações aceitas pelo fundo.',
  TIPO_RECEBIVEL: 'O tipo de recebível desta nota não está habilitado na configuração atual.',
  VALOR_MINIMO: 'O valor nominal da nota está abaixo do valor mínimo configurado para análise.',
  NAO_VENCIDA: 'A data de vencimento da nota já passou.',
  PRAZO_MAXIMO: 'O prazo entre a aquisição e o vencimento ultrapassa o limite configurado.',
  PRAZO_MINIMO: 'O prazo da nota é menor que o mínimo configurado para o fundo.',
  CONCENTRACAO_MAXIMA_SACADO: 'A participação deste sacado no lote ultrapassa o percentual máximo permitido.',
  CONCENTRACAO_MAXIMA_CEDENTE: 'A participação deste cedente no lote ultrapassa o percentual máximo permitido.',
}

export function formatReason(reason: string) {
  return explanations[reason] ?? reason.replace(/_/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

