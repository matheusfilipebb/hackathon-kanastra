import { memo, useMemo } from 'react'
import { getReasonTitle, uniqueReasons } from './reasons'
import { useDashboardPanels } from './useDashboardPanels'
import './Dashboard.css'

type Row = { fundo: string; fundoDocumento: string; aprovado: boolean; motivos: string[] }
type Slice = { label: string; value: number; color: string }
const colors = ['#193C32', '#2DAA82', '#14735A', '#1E5546', '#638B80', '#C35A50', '#2DAA82', '#A7473F', '#527CA3']
const number = new Intl.NumberFormat('pt-BR')
const percent = (value: number, total: number) => `${(total ? value / total * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function Pie({ slices, title, empty }: { slices: Slice[]; title: string; empty: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  let offset = 0
  return <article className="dashboard-chart"><h3>{title}</h3>{total ? <div className="dashboard-chart-content">
    <svg viewBox="0 0 220 220" className="dashboard-pie" role="img" aria-label={`${title}: ${slices.map(slice => `${slice.label}, ${number.format(slice.value)}, ${percent(slice.value, total)}`).join('; ')}`}>
      {slices.filter(slice => slice.value > 0).map(slice => {
        const length = slice.value / total * 100
        const start = offset; offset += length
        return <circle key={slice.label} cx="110" cy="110" r="78" fill="none" stroke={slice.color} strokeWidth="42" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 110 110)"><title>{`${slice.label}: ${number.format(slice.value)} (${percent(slice.value, total)})`}</title></circle>
      })}
      <text x="110" y="108" textAnchor="middle" className="pie-total">{number.format(total)}</text><text x="110" y="128" textAnchor="middle" className="pie-caption">{title === 'Resultado da análise' ? 'notas' : 'ocorrências'}</text>
    </svg>
    <ul className="dashboard-legend" data-dashboard-scroll tabIndex={0} aria-label={`Legenda de ${title}`}>{slices.map(slice => <li key={slice.label}><span className="dashboard-swatch" style={{ background: slice.color }} /><span>{slice.label}</span><strong>{percent(slice.value, total)}<small>{number.format(slice.value)}</small></strong></li>)}</ul>
  </div> : <p className="dashboard-empty">{empty}</p>}</article>
}

type FundSummary = { key: string; name: string; document: string; approved: number; rejected: number }

function FundColumns({ funds }: { funds: FundSummary[] }) {
  const maximum = funds.reduce((max, fund) => Math.max(max, fund.approved, fund.rejected), 1)
  const tickStep = Math.max(1, Math.ceil(maximum / 4))
  const axisMaximum = tickStep * 4
  const chartHeight = 240
  const chartTop = 36
  const baseline = chartTop + chartHeight
  const chartLeft = 70
  const groupWidth = 130
  const width = Math.max(650, chartLeft + funds.length * groupWidth + 20)
  const plotWidth = width - chartLeft - 20
  return <article className="dashboard-chart fund-columns"><h3>Notas aprovadas e não aprovadas por fundo</h3>
    <div className="fund-bars-legend"><span><i style={{ background: '#2DAA82' }} />Aprovadas</span><span><i style={{ background: '#C35A50' }} />Não aprovadas</span></div>
    <p className="dashboard-note">Quantidade de notas · as colunas comparam os resultados de cada fundo.</p>
    {funds.length ? <div className="fund-columns-scroll" data-dashboard-scroll tabIndex={0} role="region" aria-label="Comparativo entre fundos, com rolagem horizontal">
      <svg style={{ minWidth: width }} width={width} height="380" viewBox={`0 0 ${width} 380`} role="img" aria-label={`Comparativo entre fundos. ${funds.map(fund => `${fund.name} ${fund.document}: ${number.format(fund.approved)} aprovadas e ${number.format(fund.rejected)} não aprovadas`).join('; ')}`}>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = tickStep * tick
          const y = baseline - chartHeight * tick / 4
          return <g key={tick}><line x1={chartLeft} x2={chartLeft + plotWidth} y1={y} y2={y} stroke="#193c3220" /><text x={chartLeft - 10} y={y + 4} textAnchor="end" className="fund-axis-label">{number.format(value)}</text></g>
        })}
        {funds.map((fund, index) => {
          const center = chartLeft + (index + .5) * plotWidth / funds.length
          const total = fund.approved + fund.rejected
          return <g key={fund.key}>
            {[{ label: 'Aprovadas', value: fund.approved, color: '#2DAA82', x: center - 33 }, { label: 'Não aprovadas', value: fund.rejected, color: '#C35A50', x: center + 3 }].map(status => {
              const height = status.value / axisMaximum * chartHeight
              return <g key={status.label}><rect x={status.x} y={baseline - height} width="30" height={height} rx="8" fill={status.color}><title>{`${fund.name} · ${fund.document} — ${status.label}: ${number.format(status.value)} (${percent(status.value, total)})`}</title></rect><text x={status.x + 15} y={baseline - height - 8} textAnchor="middle" className="fund-column-value">{number.format(status.value)}</text></g>
            })}
            <text x={center} y={baseline + 24} textAnchor="middle" className="fund-axis-label"><title>{`${fund.name} · ${fund.document}`}</title>{fund.name.length > 17 ? `${fund.name.slice(0, 16)}…` : fund.name}</text>
            <text x={center} y={baseline + 43} textAnchor="middle" className="fund-axis-document">{fund.document}</text>
          </g>
        })}
        <text x={chartLeft + plotWidth / 2} y="365" textAnchor="middle" className="fund-axis-label">Fundos</text>
      </svg>
    </div> : <p className="dashboard-empty">Nenhum fundo para comparar.</p>}
  </article>
}

function Dashboard({ rows, selectedFund, onFundChange }: { rows: Row[]; selectedFund: string; onFundChange: (fund: string) => void }) {
  const { containerRef, activePanel, setPanel, onKeyDown, onTouchStart, onTouchEnd } = useDashboardPanels()
  const funds = useMemo(() => {
    const grouped = new Map<string, string>()
    for (const row of rows) grouped.set(row.fundoDocumento || row.fundo, `${row.fundo}${row.fundoDocumento ? ` · ${row.fundoDocumento}` : ''}`)
    return [...grouped].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])
  const fundComparison = useMemo(() => {
    const grouped = new Map<string, FundSummary>()
    for (const row of rows) {
      const key = row.fundoDocumento || row.fundo
      const fund = grouped.get(key) ?? { key, name: row.fundo, document: row.fundoDocumento, approved: 0, rejected: 0 }
      if (row.aprovado) fund.approved++
      else fund.rejected++
      grouped.set(key, fund)
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
  }, [rows])
  const summary = useMemo(() => {
    let approved = 0
    let rejected = 0
    const reasons = new Map<string, number>()
    for (const row of rows) {
      if (selectedFund && (row.fundoDocumento || row.fundo) !== selectedFund) continue
      if (row.aprovado) approved++
      else {
        rejected++
        const rowReasons = uniqueReasons(row.motivos)
        for (const reason of rowReasons.length ? rowReasons : ['Motivo não informado']) {
          const label = getReasonTitle(reason)
          reasons.set(label, (reasons.get(label) ?? 0) + 1)
        }
      }
    }
    return { approved, rejected, reasons: [...reasons].sort((a, b) => b[1] - a[1]).map(([label, value], index) => ({ label, value, color: colors[index % colors.length] })) }
  }, [rows, selectedFund])

  const total = summary.approved + summary.rejected
  return <section ref={containerRef} className="dashboard dashboard-experience" aria-labelledby="dashboard-title" onKeyDown={onKeyDown} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <header className="dashboard-header">
      <div><p className="eyebrow">VISÃO DA CARTEIRA</p><h2 id="dashboard-title">Dashboard da análise</h2><p>{number.format(activePanel === 0 ? total : rows.length)} notas · {activePanel === 0 && selectedFund ? 'fundo selecionado' : `${funds.length} ${funds.length === 1 ? 'fundo' : 'fundos'} no arquivo`}</p></div>
      <label>{activePanel === 0 ? 'Filtrar visão geral por fundo' : 'Comparativo de todos os fundos'}<select aria-label="Filtrar por fundo" disabled={activePanel === 1} value={activePanel === 0 ? selectedFund : ''} onChange={event => onFundChange(event.target.value)}><option value="">Todos os fundos</option>{funds.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </header>
    <div className="dashboard-stage" tabIndex={0} role="region" aria-label="Gráficos da análise. Use as setas para cima e para baixo para trocar de painel." data-panel-index={activePanel}>
      <section id="dashboard-overview" className={`dashboard-panel${activePanel === 0 ? ' is-active' : ''}`} data-position={activePanel === 0 ? 'current' : 'before'} aria-label="Visão geral em gráficos de pizza" aria-hidden={activePanel !== 0} ref={element => { if (element) element.inert = activePanel !== 0 }}>
        <div className="dashboard-charts"><Pie title="Resultado da análise" empty="Nenhuma nota para este fundo." slices={[{ label: 'Aprovadas', value: summary.approved, color: '#2DAA82' }, { label: 'Não aprovadas', value: summary.rejected, color: '#C35A50' }]} /><Pie title="Por que as notas não foram aprovadas?" empty="Todas as notas deste fundo foram aprovadas." slices={summary.reasons} /></div>
        <p className="dashboard-panel-note">Percentuais por quantidade de notas. Uma nota pode ter vários motivos; o gráfico de motivos considera o total de ocorrências.</p>
      </section>
      <section id="dashboard-funds" className={`dashboard-panel${activePanel === 1 ? ' is-active' : ''}`} data-position={activePanel === 1 ? 'current' : 'after'} aria-label="Comparativo por fundo em gráficos de colunas" aria-hidden={activePanel !== 1} ref={element => { if (element) element.inert = activePanel !== 1 }}>
        <FundColumns funds={fundComparison} />
        <p className="dashboard-panel-note">Todos os fundos do arquivo, independentemente do filtro da visão geral. Role horizontalmente quando houver mais fundos.</p>
      </section>
    </div>
    <footer className="dashboard-panel-navigation">
      <nav aria-label="Tipos de gráfico"><button type="button" aria-pressed={activePanel === 0} aria-controls="dashboard-overview" onClick={() => setPanel(0)}><span>01</span> Visão geral</button><button type="button" aria-pressed={activePanel === 1} aria-controls="dashboard-funds" onClick={() => setPanel(1)}><span>02</span> Por fundo</button></nav>
      <span className="dashboard-scroll-hint" aria-hidden="true">{activePanel === 0 ? 'Role para ver o comparativo ↓' : 'Role para voltar à visão geral ↑'}</span>
      <span className="dashboard-panel-announcement" role="status">{activePanel === 0 ? 'Painel 1 de 2: gráficos de pizza' : 'Painel 2 de 2: gráficos de colunas'}</span>
    </footer>
  </section>
}

export default memo(Dashboard)
