export type ReasonDetails = { title: string; description: string; action: string }

const explanations: Record<string, ReasonDetails> = {
  CNPJ_SACADO_VALIDO: {
    title: 'CNPJ do pagador inválido',
    description: 'O CNPJ da empresa que deve pagar esta nota está incompleto ou não passou na verificação dos dígitos.',
    action: 'Confira o CNPJ do pagador (sacado) no arquivo e corrija eventuais erros de digitação.',
  },
  SITUACAO_CADASTRAL_SACADO: {
    title: 'Cadastro do pagador não aceito',
    description: 'O CNPJ do pagador não consta na base cadastral de demonstração usada pela análise ou está com uma situação que o fundo não aceita.',
    action: 'Confira o CNPJ no arquivo e o cadastro na base da operação. A regra também depende das situações aceitas pelo fundo.',
  },
  TIPO_RECEBIVEL: {
    title: 'Tipo de recebível não aceito',
    description: 'O tipo desta nota não faz parte dos tipos de recebível aceitos na análise.',
    action: 'Confira o tipo informado no arquivo e os tipos permitidos nas regras da operação.',
  },
  VALOR_MINIMO: {
    title: 'Valor abaixo do mínimo',
    description: 'O valor desta nota é menor que o mínimo definido para a operação.',
    action: 'Confira o valor nominal no arquivo e o limite mínimo usado na análise.',
  },
  NAO_VENCIDA: {
    title: 'Vencimento fora da data permitida',
    description: 'A nota já estava vencida na data de referência da análise ou uma das datas não pôde ser validada. No CSV, a referência é a data de aquisição.',
    action: 'Confira as datas de aquisição e vencimento no arquivo.',
  },
  PRAZO_MAXIMO: {
    title: 'Prazo maior que o permitido',
    description: 'O intervalo entre a aquisição e o vencimento não atende ao prazo máximo da operação.',
    action: 'Confira as duas datas e compare o intervalo com o prazo máximo usado na análise.',
  },
  PRAZO_MINIMO: {
    title: 'Prazo menor que o permitido',
    description: 'O intervalo entre a aquisição e o vencimento não atende ao prazo mínimo da operação.',
    action: 'Confira as duas datas e compare o intervalo com o prazo mínimo usado na análise.',
  },
  CONCENTRACAO_MAXIMA_SACADO: {
    title: 'Limite por pagador excedido',
    description: 'O valor concentrado neste pagador ultrapassou o limite do fundo no cálculo do lote. Empresas com a mesma raiz de CNPJ são somadas.',
    action: 'Revise a distribuição dos valores entre os pagadores no lote deste fundo. Esse motivo considera o conjunto das notas.',
  },
  CONCENTRACAO_MAXIMA_CEDENTE: {
    title: 'Limite por cedente excedido',
    description: 'O valor concentrado na empresa que cedeu a nota ultrapassou o limite do fundo no cálculo do lote.',
    action: 'Revise a distribuição dos valores entre os cedentes no lote deste fundo. Esse motivo considera o conjunto das notas.',
  },
}

export function getReasonDetails(reason: string): ReasonDetails {
  const text = reason.trim()
  return Object.prototype.hasOwnProperty.call(explanations, text) ? explanations[text] : {
    title: text && !/^[A-Z0-9_]+$/i.test(text) ? text : 'Outro critério não atendido',
    description: 'A análise informou um critério adicional que esta nota não atendeu.',
    action: 'Confira os dados da nota com a equipe responsável pela operação.',
  }
}

export function getReasonTitle(reason: string) {
  return getReasonDetails(reason).title
}

export function formatReason(reason: string) {
  return getReasonDetails(reason).description
}

export function uniqueReasons(reasons: string[]) {
  return [...new Set(reasons.map(reason => reason.trim()).filter(Boolean))]
}

