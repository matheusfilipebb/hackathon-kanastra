export type SearchableInvoice = { fundo: string; fundoDocumento: string; cedente: string; sacado: string; cnpj: string; aprovado: boolean; valor: number }
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function indexInvoices<T extends SearchableInvoice>(rows: T[]) {
  return rows.map(row => ({ row, fund: row.fundoDocumento || row.fundo, cedente: normalizeSearch(row.cedente), sacado: normalizeSearch(`${row.sacado} ${row.cnpj}`), document: row.cnpj.replace(/\D/g, '') }))
}

export function queryInvoices<T extends SearchableInvoice>(index: ReturnType<typeof indexInvoices<T>>, fund: string, cedente: string, sacado: string) {
  const cedenteQuery = normalizeSearch(cedente)
  const sacadoQuery = normalizeSearch(sacado)
  const documentQuery = sacadoQuery.replace(/\D/g, '')
  const isDocument = documentQuery.length > 0 && /^[\d\s./-]+$/.test(sacadoQuery)
  const rows: T[] = []
  let approved = 0
  let totalValue = 0
  for (const entry of index) {
    if (fund && entry.fund !== fund) continue
    if (cedenteQuery && !entry.cedente.includes(cedenteQuery)) continue
    if (sacadoQuery && !(isDocument ? entry.document.includes(documentQuery) : entry.sacado.includes(sacadoQuery))) continue
    rows.push(entry.row)
    if (entry.row.aprovado) approved++
    totalValue += entry.row.valor
  }
  return { rows, approved, rejected: rows.length - approved, totalValue }
}
