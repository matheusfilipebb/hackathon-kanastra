import { memo, useMemo } from 'react'

type Row = { fundo: string; fundoDocumento: string; aprovado: boolean; motivos: string[] }
type Slice = { label: string; value: number; color: string }
const colors = ['#193C32', '#2DAA82', '#14735A', '#1E5546', '#638B80', '#C35A50', '#2DAA82', '#A7473F', '#527CA3']
const number = new Intl.NumberFormat('pt-BR')
const percent = (value: number, total: number) => `${(total ? value / total * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const reasonLabels: Record<string, string> = {
  CNPJ_SACADO_VALIDO: 'CNPJ do sacado inválido', SITUACAO_CADASTRAL_SACADO: 'Situação cadastral do sacado',
  TIPO_RECEBIVEL: 'Tipo de recebível não aceito', VALOR_MINIMO: 'Valor abaixo do mínimo',
  NAO_VENCIDA: 'Nota vencida', PRAZO_MAXIMO: 'Prazo acima do máximo', PRAZO_MINIMO: 'Prazo abaixo do mínimo',
  CONCENTRACAO_MAXIMA_SACADO: 'Concentração máxima do sacado', CONCENTRACAO_MAXIMA_CEDENTE: 'Concentração máxima do cedente',
}

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
    <ul className="dashboard-legend">{slices.map(slice => <li key={slice.label}><span className="dashboard-swatch" style={{ background: slice.color }} /><span>{slice.label}</span><strong>{percent(slice.value, total)}<small>{number.format(slice.value)}</small></strong></li>)}</ul>
  </div> : <p className="dashboard-empty">{empty}</p>}</article>
}

type FundSummary = { key: string; name: string; document: string; approved: number; rejected: number }

function FundColumns({ funds }: { funds: FundSummary[] }) {
  const maximum = Math.max(...funds.flatMap(fund => [fund.approved, fund.rejected]), 1)
  const chartHeight = 240
  const chartTop = 36
  const baseline = chartTop + chartHeight
  const chartLeft = 70
  const groupWidth = 130
  const width = Math.max(650, chartLeft + funds.length * groupWidth + 20)
  const plotWidth = width - chartLeft - 20
  return <article className="dashboard-chart fund-columns"><h3>Notas aceitas e barradas por fundo</h3>
    <div className="fund-bars-legend"><span><i style={{ background: '#2DAA82' }} />Aceitas</span><span><i style={{ background: '#C35A50' }} />Barradas</span></div>
    <p className="dashboard-note">Quantidade de notas · passe o mouse sobre as colunas para ver os percentuais.</p>
    {funds.length ? <div className="fund-columns-scroll" tabIndex={0} role="region" aria-label="Comparativo entre fundos, com rolagem horizontal">
      <svg width={width} height="380" viewBox={`0 0 ${width} 380`} role="img" aria-label={`Comparativo entre fundos. ${funds.map(fund => `${fund.name} ${fund.document}: ${number.format(fund.approved)} aceitas e ${number.format(fund.rejected)} barradas`).join('; ')}`}>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = maximum * tick / 4
          const y = baseline - chartHeight * tick / 4
          return <g key={tick}><line x1={chartLeft} x2={chartLeft + plotWidth} y1={y} y2={y} stroke="#193c3220" /><text x={chartLeft - 10} y={y + 4} textAnchor="end" className="fund-axis-label">{number.format(value)}</text></g>
        })}
        {funds.map((fund, index) => {
          const center = chartLeft + (index + .5) * plotWidth / funds.length
          const total = fund.approved + fund.rejected
          return <g key={fund.key}>
            {[{ label: 'Aceitas', value: fund.approved, color: '#2DAA82', x: center - 33 }, { label: 'Barradas', value: fund.rejected, color: '#C35A50', x: center + 3 }].map(status => {
              const height = status.value / maximum * chartHeight
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
        for (const reason of new Set(row.motivos.length ? row.motivos : ['Motivo não informado'])) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
      }
    }
    return { approved, rejected, reasons: [...reasons].sort((a, b) => b[1] - a[1]).map(([label, value], index) => ({ label: reasonLabels[label] ?? label, value, color: colors[index % colors.length] })) }
  }, [rows, selectedFund])

  return <section className="dashboard" aria-labelledby="dashboard-title">
    <div className="dashboard-header"><div><p className="eyebrow"></p><h2 id="dashboard-title">Dashboard da análise</h2><p>Percentuais calculados pela quantidade de notas.</p></div><label>Filtrar por fundo<select value={selectedFund} onChange={event => onFundChange(event.target.value)}><option value="">Todos os fundos</option>{funds.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="dashboard-charts"><Pie title="Resultado da análise" empty="Nenhuma nota para este fundo." slices={[{ label: 'Aceitas', value: summary.approved, color: '#2DAA82' }, { label: 'Barradas', value: summary.rejected, color: '#C35A50' }]} /><Pie title="Motivos de bloqueio" empty="Nenhuma nota barrada neste fundo." slices={summary.reasons} /></div>
    <div className="fund-comparison-heading"><h3>Comparativo entre fundos</h3><p>Exibe todos os fundos do arquivo, independentemente do filtro selecionado.</p></div>
    <FundColumns funds={fundComparison} />
    <p className="dashboard-note">Uma nota pode ter mais de um motivo de bloqueio. A pizza de motivos mostra a participação de cada motivo no total de ocorrências.</p>
  </section>
}

export default memo(Dashboard)
