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
