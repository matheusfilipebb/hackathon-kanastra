export type DashboardRow = {
  fundo: string; fundoDocumento: string; aprovado: boolean; motivos: string[]
  valor: number; vencimento: string; sacado: string; cnpj: string
  cedente: string; cedenteDocumento?: string
  precificacao?: { prazo_dias: number; valor_nominal: number; valor_desconto: number; valor_liquido: number }
}
export const formatNumber = new Intl.NumberFormat('pt-BR')
export const formatCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const cents = (value: number) => Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : 0
export const share = (value: number, total: number) => total > 0 ? value / total * 100 : 0
export const formatShare = (value: number, total: number) => `${share(value, total).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
export function financialSummary(rows: DashboardRow[]) {
  let approved = 0, rejected = 0, invalid = 0
  for (const row of rows) {
    if (!Number.isFinite(row.valor) || row.valor < 0) invalid++
    if (row.aprovado) approved += cents(row.valor)
    else rejected += cents(row.valor)
  }
  return { approved, rejected, total: approved + rejected, invalid }
}

export function dateDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() / 86400000 : null
}
export function todayInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function maturitySummary(rows: DashboardRow[], reference: string) {
  const today = dateDay(reference)
  if (today === null) throw new Error('Data de referência inválida')
  const buckets = ['Vencidas', 'Vencem hoje', 'De 1 a 7 dias', 'De 8 a 30 dias', 'De 31 a 60 dias', 'De 61 a 90 dias', 'Acima de 90 dias', 'Sem data válida'].map(label => ({ label, value: 0, count: 0 }))
  for (const row of rows) {
    const day = dateDay(row.vencimento)
    const delta = day === null ? null : day - today
    const index = delta === null ? 7 : delta < 0 ? 0 : delta === 0 ? 1 : delta <= 7 ? 2 : delta <= 30 ? 3 : delta <= 60 ? 4 : delta <= 90 ? 5 : 6
    buckets[index].value += cents(row.valor)
    buckets[index].count++
  }
  return buckets
}

export type ConcentrationGroup = { key: string; label: string; document: string; value: number; count: number }
export function concentrationSummary(rows: DashboardRow[], kind: 'sacado' | 'cedente') {
  const grouped = new Map<string, ConcentrationGroup>()
  for (const row of rows) {
    const name = (kind === 'sacado' ? row.sacado : row.cedente)?.trim() || 'Nome não informado'
    const document = (kind === 'sacado' ? row.cnpj : row.cedenteDocumento)?.replace(/\D/g, '') || ''
    const key = document ? `doc:${document}` : `nome:${name.toLocaleLowerCase('pt-BR')}`
    const group = grouped.get(key) ?? { key, label: name, document, value: 0, count: 0 }
    group.value += cents(row.valor)
    group.count++
    grouped.set(key, group)
  }
  return [...grouped.values()].sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
}
