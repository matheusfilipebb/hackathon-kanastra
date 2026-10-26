import type { ReactNode } from 'react'
import { maturitySummary, todayInSaoPaulo, financialSummary, formatCurrency as money, formatNumber as number, formatShare, share } from './dashboardMetrics'
import type { DashboardRow } from './dashboardMetrics'

export function InsightMetrics({ items }: { items: { label: string; value: string; detail?: string }[] }) {
  return <dl className="insight-metrics">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd>{item.detail && <small>{item.detail}</small>}</div>)}</dl>
}
export function InsightCard({ title, children, note }: { title: string; children: ReactNode; note: string }) {
  return <article className="dashboard-chart insight-card"><h3>{title}</h3>{children}<p className="dashboard-panel-note">{note}</p></article>
}
export function ValueBars({ items, total, label }: { items: { label: string; value: number; detail: string; color?: string }[]; total: number; label: string }) {
  const maximum = items.reduce((max, item) => Math.max(max, item.value), 1)
  return <div className="insight-scroll" data-dashboard-scroll tabIndex={0} role="region" aria-label={label}><ul className="insight-bars">{items.map(item => <li key={item.label}><div className="insight-bar-heading"><span>{item.label}</span><strong>{money.format(item.value / 100)}</strong></div><div className="insight-track" aria-hidden="true"><span style={{ width: `${share(item.value, maximum)}%`, background: item.color ?? '#2daa82' }} /></div><small>{item.detail} · {formatShare(item.value, total)} do valor</small></li>)}</ul>{items.length === 0 && <p className="dashboard-empty">Nenhum dado disponível para este recorte.</p>}</div>
}
export function FinancialPanel({ rows }: { rows: DashboardRow[] }) {
  const summary = financialSummary(rows)
  return <InsightCard title="Impacto financeiro da análise" note={`Valores nominais do arquivo, sem desconto de antecipação.${summary.invalid ? ` ${number.format(summary.invalid)} notas com valor inválido foram excluídas dos totais em R$.` : ''}`}>
    <InsightMetrics items={[{ label: 'Valor analisado', value: money.format(summary.total / 100) }, { label: 'Aprovado', value: money.format(summary.approved / 100), detail: `${formatShare(summary.approved, summary.total)} do valor` }, { label: 'Não aprovado', value: money.format(summary.rejected / 100), detail: 'Valor fora da operação neste resultado' }]} />
    <ValueBars label="Distribuição do valor nominal por resultado" total={summary.total} items={[{ label: 'Aprovadas', value: summary.approved, detail: `${number.format(rows.filter(row => row.aprovado).length)} notas`, color: '#2daa82' }, { label: 'Não aprovadas', value: summary.rejected, detail: `${number.format(rows.filter(row => !row.aprovado).length)} notas`, color: '#c35a50' }]} />
  </InsightCard>
}

export function MaturityPanel({ rows }: { rows: DashboardRow[] }) {
  const reference = todayInSaoPaulo()
  const buckets = maturitySummary(rows, reference)
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0)
  return <InsightCard title="Agenda de vencimentos" note={`Referência: ${reference.split('-').reverse().join('/')} · horário de São Paulo. Inclui aprovadas e não aprovadas. Datas inválidas aparecem em uma faixa separada.`}>
    <InsightMetrics items={[{ label: 'Valor vencido', value: money.format(buckets[0].value / 100), detail: `${number.format(buckets[0].count)} notas` }, { label: 'Vence em até 7 dias', value: money.format((buckets[1].value + buckets[2].value) / 100), detail: 'Inclui as notas que vencem hoje' }, { label: 'Sem data válida', value: number.format(buckets[7].count), detail: 'Notas para conferir no arquivo' }]} />
    <ValueBars label="Valores por faixa de vencimento" total={total} items={buckets.map((bucket, index) => ({ ...bucket, detail: `${number.format(bucket.count)} notas`, color: index === 0 ? '#c35a50' : index < 3 ? '#b77b32' : '#2daa82' }))} />
  </InsightCard>
}
