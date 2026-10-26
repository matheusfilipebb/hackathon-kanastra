export type Configuration = {
  fundo: { nome: string; cnpj: string }
  validadores: { codigo: string; ativo: boolean; parametros: Record<string, unknown> }[]
  precificacao: { metodo: string; taxa_mensal_percentual: number; base_dias: number }
}
export type EditorTab = 'fund' | 'rules' | 'pricing'
export type EditorIssue = { tab: EditorTab; field: string; message: string; rule?: string }
export const ruleInfo: Record<string, { title: string; description: string; group: string }> = {
  CNPJ_SACADO_VALIDO: { title: 'CNPJ do pagador', description: 'Confere se o CNPJ de quem vai pagar a nota é válido.', group: 'Cadastro do pagador' },
  SITUACAO_CADASTRAL_SACADO: { title: 'Situação cadastral', description: 'Aceita apenas as situações cadastrais escolhidas para o pagador.', group: 'Cadastro do pagador' },
  TIPO_RECEBIVEL: { title: 'Tipos de recebível', description: 'Define quais títulos podem participar da operação.', group: 'Critérios da nota' },
  VALOR_MINIMO: { title: 'Valor mínimo da nota', description: 'Exige um valor nominal mínimo para cada nota.', group: 'Critérios da nota' },
  NAO_VENCIDA: { title: 'Nota dentro do vencimento', description: 'Compara o vencimento com a data de aquisição registrada no arquivo.', group: 'Critérios da nota' },
  PRAZO_MAXIMO: { title: 'Prazo máximo', description: 'Limita os dias entre a aquisição e o vencimento da nota.', group: 'Critérios da nota' },
  PRAZO_MINIMO: { title: 'Prazo mínimo', description: 'Exige um prazo mínimo entre aquisição e vencimento.', group: 'Critérios da nota' },
  CONCENTRACAO_MAXIMA_SACADO: { title: 'Concentração por pagador', description: 'Limita a participação de um pagador no valor total das notas do fundo.', group: 'Concentração da carteira' },
  CONCENTRACAO_MAXIMA_CEDENTE: { title: 'Concentração por cedente', description: 'Limita a participação da empresa que vende as notas na carteira do fundo.', group: 'Concentração da carteira' },
}
export const parameterLabels: Record<string, string> = {
  valor_minimo: 'Valor mínimo (R$)', percentual_maximo: 'Participação máxima (%)',
  prazo_minimo_dias: 'Prazo mínimo (dias)', prazo_maximo_dias: 'Prazo máximo (dias)',
  agrupamento: 'Agrupar pagadores por', tipos_aceitos: 'Tipos aceitos', situacoes_aceitas: 'Situações aceitas',
}
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function parameterSummary(rule: Configuration['validadores'][number]) {
  return Object.entries(rule.parametros).map(([key, value]) => {
    if (Array.isArray(value)) return value.join(', ')
    if (key === 'agrupamento' && value === 'RAIZ_CNPJ') return 'Raiz do CNPJ'
    if (typeof value === 'number' && !Number.isFinite(value)) return 'Valor a conferir'
    if (key === 'valor_minimo' && typeof value === 'number') return `A partir de ${money.format(value)}`
    if (key === 'percentual_maximo') return `Até ${Number(value).toLocaleString('pt-BR')}%`
    if (key === 'prazo_minimo_dias') return `A partir de ${value} dias`
    if (key === 'prazo_maximo_dias') return `Até ${value} dias`
    return String(value ?? '')
  }).join(' · ') || 'Sem parâmetros adicionais'
}
export function validateEditor(config: Configuration): EditorIssue | null {
  for (const key of ['nome', 'cnpj'] as const) {
    if (!config.fundo[key].trim() || config.fundo[key].length > 200) return { tab: 'fund', field: `fund-${key}`, message: `Preencha ${key === 'nome' ? 'o nome' : 'o CNPJ'} do fundo com até 200 caracteres.` }
  }
  for (const rule of config.validadores) {
    for (const [key, value] of Object.entries(rule.parametros)) {
      const issue = { tab: 'rules' as const, rule: rule.codigo, field: `${rule.codigo}-${key}`, message: `Confira ${parameterLabels[key]?.toLocaleLowerCase('pt-BR') ?? key} em “${ruleInfo[rule.codigo]?.title ?? 'Regra'}”.` }
      if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > (key === 'percentual_maximo' ? 100 : key === 'valor_minimo' ? Number.MAX_SAFE_INTEGER / 100 : Number.MAX_SAFE_INTEGER) || (key.endsWith('_dias') && !Number.isSafeInteger(value)))) return issue
      if (Array.isArray(value) && (!value.length || value.length > 50 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 200) || new Set(value).size !== value.length)) return { ...issue, message: `${parameterLabels[key] ?? 'Lista'}: escolha ao menos uma opção, sem repetições.` }
      if (typeof value === 'string' && (!value.trim() || value.length > 200)) return issue
    }
  }
  const min = config.validadores.find(rule => rule.codigo === 'PRAZO_MINIMO' && rule.ativo)
  const max = config.validadores.find(rule => rule.codigo === 'PRAZO_MAXIMO' && rule.ativo)
  if (min && max && Number(min.parametros.prazo_minimo_dias) > Number(max.parametros.prazo_maximo_dias)) return { tab: 'rules', rule: min.codigo, field: `${min.codigo}-prazo_minimo_dias`, message: 'O prazo mínimo deve ser menor ou igual ao prazo máximo quando as duas regras estão ativas.' }
  if (!Number.isFinite(config.precificacao.taxa_mensal_percentual) || config.precificacao.taxa_mensal_percentual < 0 || config.precificacao.taxa_mensal_percentual > Number.MAX_SAFE_INTEGER) return { tab: 'pricing', field: 'pricing-rate', message: 'Informe uma taxa mensal válida, maior ou igual a zero.' }
  if (!Number.isSafeInteger(config.precificacao.base_dias) || config.precificacao.base_dias < 1) return { tab: 'pricing', field: 'pricing-days', message: 'A base de cálculo deve ser um número inteiro de dias, maior que zero.' }
  return null
}
export function normalizedConfiguration(config: Configuration): Configuration {
  return { ...config, fundo: { nome: config.fundo.nome.trim(), cnpj: config.fundo.cnpj.trim() }, validadores: config.validadores.map(rule => ({ ...rule, parametros: Object.fromEntries(Object.entries(rule.parametros).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) })) }
}
