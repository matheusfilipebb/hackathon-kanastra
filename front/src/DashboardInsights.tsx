import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { pricingSummary, reasonImpactSummary, concentrationSummary, maturitySummary, todayInSaoPaulo, financialSummary, formatCurrency as money, formatNumber as number, formatShare, share } from './dashboardMetrics'
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
  const summary = useMemo(() => financialSummary(rows), [rows])
  return <InsightCard title="Impacto financeiro da análise" note={`Valores nominais do arquivo, sem desconto de antecipação.${summary.invalid ? ` ${number.format(summary.invalid)} notas com valor inválido foram excluídas dos totais em R$.` : ''}`}>
    <InsightMetrics items={[{ label: 'Valor analisado', value: money.format(summary.total / 100) }, { label: 'Aprovado', value: money.format(summary.approved / 100), detail: `${formatShare(summary.approved, summary.total)} do valor` }, { label: 'Não aprovado', value: money.format(summary.rejected / 100), detail: 'Valor fora da operação neste resultado' }]} />
    <ValueBars label="Distribuição do valor nominal por resultado" total={summary.total} items={[{ label: 'Aprovadas', value: summary.approved, detail: `${number.format(rows.filter(row => row.aprovado).length)} notas`, color: '#2daa82' }, { label: 'Não aprovadas', value: summary.rejected, detail: `${number.format(rows.filter(row => !row.aprovado).length)} notas`, color: '#c35a50' }]} />
  </InsightCard>
}

export function MaturityPanel({ rows }: { rows: DashboardRow[] }) {
  const reference = todayInSaoPaulo()
  const buckets = useMemo(() => maturitySummary(rows, reference), [rows, reference])
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0)
  return <InsightCard title="Agenda de vencimentos" note={`Referência: ${reference.split('-').reverse().join('/')} · horário de São Paulo. Inclui aprovadas e não aprovadas. Datas inválidas aparecem em uma faixa separada.`}>
    <InsightMetrics items={[{ label: 'Valor vencido', value: money.format(buckets[0].value / 100), detail: `${number.format(buckets[0].count)} notas` }, { label: 'Vence em até 7 dias', value: money.format((buckets[1].value + buckets[2].value) / 100), detail: 'Inclui as notas que vencem hoje' }, { label: 'Sem data válida', value: number.format(buckets[7].count), detail: 'Notas para conferir no arquivo' }]} />
    <ValueBars label="Valores por faixa de vencimento" total={total} items={buckets.map((bucket, index) => ({ ...bucket, detail: `${number.format(bucket.count)} notas`, color: index === 0 ? '#c35a50' : index < 3 ? '#b77b32' : '#2daa82' }))} />
  </InsightCard>
}

export function ConcentrationPanel({ rows }: { rows: DashboardRow[] }) {
  const [kind, setKind] = useState<'sacado' | 'cedente'>('sacado')
  const groups = useMemo(() => concentrationSummary(rows, kind), [rows, kind])
  const total = groups.reduce((sum, group) => sum + group.value, 0)
  const top = groups.slice(0, 10)
  const others = groups.slice(10)
  const items = top.map(group => ({ label: `${group.label}${group.document ? ` · ${group.document}` : ''}`, value: group.value, detail: `${number.format(group.count)} notas${group.document ? '' : ' · agrupado pelo nome'}` }))
  if (others.length) items.push({ label: 'Demais participantes', value: others.reduce((sum, group) => sum + group.value, 0), detail: `${number.format(others.length)} participantes` })
  return <InsightCard title="Concentração da carteira" note="Participação no valor nominal do recorte, incluindo aprovadas e não aprovadas. Não substitui a validação de limites por fundo. Sem documento, o agrupamento usa o nome.">
    <div className="insight-switch" role="group" aria-label="Agrupar concentração por"><button type="button" aria-pressed={kind === 'sacado'} onClick={() => setKind('sacado')}>Sacados</button><button type="button" aria-pressed={kind === 'cedente'} onClick={() => setKind('cedente')}>Cedentes</button></div>
    <InsightMetrics items={[{ label: 'Maior participação', value: formatShare(groups[0]?.value ?? 0, total), detail: groups[0]?.label ?? 'Sem participantes' }, { label: 'Cinco maiores', value: formatShare(groups.slice(0, 5).reduce((sum, group) => sum + group.value, 0), total), detail: 'Participação conjunta no valor' }, { label: kind === 'sacado' ? 'Sacados no recorte' : 'Cedentes no recorte', value: number.format(groups.length), detail: 'Ranking dos dez maiores abaixo' }]} />
    <ValueBars label={`Ranking de concentração por ${kind}`} total={total} items={items} />
  </InsightCard>
}

export function ReasonImpactPanel({ rows }: { rows: DashboardRow[] }) {
  const reasons = useMemo(() => reasonImpactSummary(rows), [rows])
  const summary = useMemo(() => financialSummary(rows), [rows])
  return <InsightCard title="Motivos com maior impacto financeiro" note="Uma nota pode ter vários motivos e participar de mais de uma barra. Os valores não devem ser somados. Corrigir um motivo não garante aprovação nos demais critérios.">
    <InsightMetrics items={[{ label: 'Valor não aprovado', value: money.format(summary.rejected / 100), detail: 'Cada nota contada uma única vez' }, { label: 'Maior impacto', value: money.format((reasons[0]?.value ?? 0) / 100), detail: reasons[0]?.label ?? 'Nenhum motivo no recorte' }, { label: 'Motivos encontrados', value: number.format(reasons.length), detail: 'Ordenados pelo valor afetado' }]} />
    <ValueBars label="Ranking de motivos por valor afetado" total={summary.rejected} items={reasons.map(reason => ({ ...reason, detail: `${number.format(reason.count)} notas não aprovadas`, color: '#b77b32' }))} />
  </InsightCard>
}

export function PricingPanel({ rows }: { rows: DashboardRow[] }) {
  const summary = useMemo(() => pricingSummary(rows), [rows])
  return <InsightCard title="Simulação de antecipação" note={`Somente notas aprovadas com precificação válida retornada pela API. ${number.format(summary.missing)} aprovadas sem simulação válida. Valores indicativos, sujeitos às condições da operação.`}>
    {summary.count ? <>
      <InsightMetrics items={[{ label: 'Valor nominal simulado', value: money.format(summary.nominal / 100), detail: `${number.format(summary.count)} de ${number.format(summary.approved)} aprovadas` }, { label: 'Desconto estimado', value: money.format(summary.discount / 100), detail: `${formatShare(summary.discount, summary.nominal)} do nominal simulado` }, { label: 'Valor líquido estimado', value: money.format(summary.liquid / 100), detail: `Prazo médio ponderado: ${summary.averageDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias` }]} />
      <div className="insight-scroll" data-dashboard-scroll tabIndex={0} role="region" aria-label="Detalhamento da simulação por fundo">
        <div className="pricing-split" aria-label={`Do nominal simulado, ${formatShare(summary.liquid, summary.nominal)} é líquido e ${formatShare(summary.discount, summary.nominal)} é desconto`}><span style={{ flex: summary.liquid, background: '#2daa82' }} /><span style={{ flex: summary.discount, background: '#b77b32' }} /></div>
        <p className="pricing-split-legend"><span>● Líquido</span><span>● Desconto</span></p>
        <table className="pricing-table"><caption>Simulação por fundo</caption><thead><tr><th>Fundo</th><th>Nominal</th><th>Desconto</th><th>Líquido</th></tr></thead><tbody>{summary.funds.map(fund => <tr key={fund.key}><td><strong>{fund.name}</strong><small>{fund.document} · {number.format(fund.count)} notas</small></td><td>{money.format(fund.nominal / 100)}</td><td>{money.format(fund.discount / 100)}</td><td>{money.format(fund.liquid / 100)}</td></tr>)}</tbody></table>
      </div>
    </> : <p className="dashboard-empty">Não há simulações disponíveis neste recorte. As notas precisam estar aprovadas e ter precificação válida retornada pela API.</p>}
  </InsightCard>
}
