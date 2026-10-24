import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Dashboard from './Dashboard'
import { indexInvoices, queryInvoices } from './listing'
import ValidatorsModal from './ValidatorsModal'
import InvoiceModal from './InvoiceModal'
import antecipaLogo from './assets/antecipe-logo-branco-sem-fundo.svg'

type Invoice = { cedenteDocumento?: string; aquisicao?: string; linha?: number; situacaoCadastral?: string; fundo: string; fundoDocumento: string; id: string; sacado: string; cnpj: string; valor: number; vencimento: string; tipo: string; situacao: string; cedente: string }
type Pricing = { prazo_dias: number; valor_nominal: number; valor_desconto: number; valor_liquido: number }
type Result = Invoice & { aprovado: boolean; motivos: string[]; precificacao?: Pricing }
type ApiResult = { linha: number; id: string; status: 'APROVADO' | 'BARRADO'; barrado_por?: string[]; precificacao?: Pricing }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const REQUIRED_CSV_HEADERS = ['NOME_FUNDO', 'DOC_FUNDO', 'NOME_CEDENTE', 'DOC_CEDENTE', 'NOME_SACADO', 'DOC_SACADO', 'NU_DOCUMENTO', 'TIPO_RECEBIVEL', 'VALOR_NOMINAL', 'DATA_VENCIMENTO_ORIGINAL', 'DATA_AQUISICAO']
const PAGE_SIZE = 25

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function normalizeInvoice(item: Record<string, unknown>, index: number): Invoice {
  const normalizedItem = Object.fromEntries(Object.entries(item).map(([key, value]) => [key.toLowerCase(), value]))
  const get = (...keys: string[]) => keys.map((key) => normalizedItem[key]).find((value) => value !== undefined && value !== null && value !== '')
  const rawValue = get('valor', 'valor_face', 'valor_nominal')
  const valueText = String(rawValue ?? '0').replace(/[^\d,.-]/g, '')
  const parsedValue = typeof rawValue === 'number' ? rawValue : Number(valueText.includes(',') ? valueText.replace(/\./g, '').replace(',', '.') : valueText)
  return { cedenteDocumento: String(get('doc_cedente', 'cnpj_cedente', 'documento_cedente') ?? ''), aquisicao: String(get('data_aquisicao', 'aquisicao') ?? ''), linha: index + 2, situacaoCadastral: String(get('situacao', 'situacao_cadastral', 'status_cadastral') ?? ''), fundo: String(get('nome_fundo', 'fundo') ?? 'Fundo não informado'), fundoDocumento: String(get('doc_fundo', 'cnpj_fundo') ?? ''), id: String(get('id', 'numero', 'nota', 'numero_nf', 'nu_documento') ?? `NF-${String(index + 1).padStart(4, '0')}`), sacado: String(get('sacado', 'nome_sacado', 'sacado_nome') ?? 'Sacado não informado'), cnpj: String(get('cnpj', 'cnpj_sacado', 'documento_sacado', 'doc_sacado') ?? ''), valor: Number.isNaN(parsedValue) ? 0 : parsedValue, vencimento: String(get('vencimento', 'data_vencimento', 'data_vencimento_original') ?? '').replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1'), tipo: String(get('tipo', 'tipo_recebivel') ?? 'Duplicata'), situacao: String(get('situacao', 'situacao_cadastral', 'status') ?? 'ATIVA').toUpperCase(), cedente: String(get('cedente', 'nome_cedente') ?? 'Cedente não informado') }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(delimiter).map((header) => header.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, (line.split(delimiter)[index] ?? '').trim().replace(/^['"]|['"]$/g, '')])))
}

function validateApiCsv(text: string) {
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]
  const columns = header.split(';').map((column) => column.trim().replace(/^"|"$/g, ''))
  if (columns.length !== REQUIRED_CSV_HEADERS.length || columns.some((column, index) => column !== REQUIRED_CSV_HEADERS[index])) {
    throw new Error(`CSV inválido. Use exatamente o cabeçalho da API, separado por ponto e vírgula: ${REQUIRED_CSV_HEADERS.join(';')}`)
  }
}

function evaluate(invoices: Invoice[]): Result[] {
  const total = invoices.reduce((sum, invoice) => sum + invoice.valor, 0)
  const today = new Date()
  return invoices.map((invoice) => {
    const reasons: string[] = []
    const dueDate = invoice.vencimento ? new Date(`${invoice.vencimento}T00:00:00`) : null
    const prazo = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / 86400000) : 0
    if (invoice.cnpj.replace(/\D/g, '').length !== 14) reasons.push('CNPJ do sacado inválido')
    if (invoice.situacao !== 'ATIVA') reasons.push('Situação cadastral não está ativa')
    if (!['DUPLICATA', 'DUPLICATA DE SERVIÇO'].includes(invoice.tipo.toUpperCase())) reasons.push('Tipo de recebível não aceito')
    if (invoice.valor < 100) reasons.push('Valor abaixo do mínimo de R$ 100')
    if (dueDate && dueDate < today) reasons.push('Nota vencida')
    if (dueDate && prazo > 180) reasons.push('Prazo superior a 180 dias')
    if (total > 0 && invoice.valor / total > 0.1) reasons.push('Concentração do sacado superior a 10%')
    return { ...invoice, aprovado: reasons.length === 0, motivos: reasons }
  })
}

function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'notas'>('dashboard')
  const [chartsExpanded, setChartsExpanded] = useState(true)
  const [search, setSearch] = useState({ cedente: '', sacado: '' })
  const [selectedFund, setSelectedFund] = useState('')
  const [cedenteFilter, setCedenteFilter] = useState('')
  const [sacadoFilter, setSacadoFilter] = useState('')
  const [validatorsOpen, setValidatorsOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Result | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'aprovadas' | 'reprovadas'>('todas')
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiLoading, setApiLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const validatorsLoaded = useRef(false)
  useEffect(() => {
    if (validatorsLoaded.current) return
    validatorsLoaded.current = true
    fetch(`${API_URL}/validadores`)
      .then((response) => { if (!response.ok) throw new Error('API indisponível'); return response.json() })
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
      .finally(() => setApiLoading(false))
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch({ cedente: cedenteFilter, sacado: sacadoFilter }), 200)
    return () => window.clearTimeout(timer)
  }, [cedenteFilter, sacadoFilter])
  useEffect(() => { setCurrentPage(1) }, [filter, results, selectedFund, search])
  const processJson = async (text: string) => {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed) && parsed?.fundo && Array.isArray(parsed?.validadores) && parsed?.precificacao) {
        setIsLoading(true)
        const response = await fetch(`${API_URL}/validadores`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
        const responseBody = await response.json().catch(() => null)
        if (!response.ok) throw new Error(responseBody?.message ?? `A API respondeu com status ${response.status}.`)
        setCurrentPage(1); setApiOnline(true); setError(''); return
      }
      const rows = Array.isArray(parsed) ? parsed : parsed.notas_fiscais ?? parsed.notas ?? parsed.data ?? []
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('JSON inválido. Envie uma lista de notas ou a configuração completa dos validadores.')
      setSelectedFund(''); setCedenteFilter(''); setSacadoFilter(''); setResults(evaluate(rows.map((item, index) => normalizeInvoice(item, index)))); setCurrentPage(1); setError('')
    } catch (fileError) { setError(fileError instanceof Error ? fileError.message : 'Não foi possível ler este arquivo.') } finally { setIsLoading(false) }
  }
  const processCsv = async (file: File) => {
    setIsLoading(true); setError('')
    try {
      const csvText = await file.text(); validateApiCsv(csvText)
      const localRows = parseCsv(csvText).map((item, index) => normalizeInvoice(item, index))
      const formData = new FormData(); formData.append('file', file)
      const response = await fetch(`${API_URL}/recebiveis/upload`, { method: 'POST', body: formData })
      if (!response.ok) { const detail = await response.json().catch(() => null); throw new Error(detail?.message ?? `A API respondeu com status ${response.status}.`) }
      const apiRows = await response.json() as ApiResult[]
      setSelectedFund(''); setCedenteFilter(''); setSacadoFilter('')
      setResults(apiRows.map((item) => { const local = localRows[item.linha - 2] ?? localRows.find((row) => row.id === item.id); return { ...(local ?? { fundo: 'Fundo não informado', fundoDocumento: '', id: item.id, sacado: 'Dados retornados pela API', cnpj: '', valor: 0, vencimento: '', tipo: '', situacao: '', cedente: '' }), linha: item.linha, aprovado: item.status === 'APROVADO', motivos: item.barrado_por ?? [], precificacao: item.precificacao } }))
      setCurrentPage(1); setApiOnline(true)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível analisar o CSV na API.'); setApiOnline(false) } finally { setIsLoading(false) }
  }
  const handleFile = (file?: File) => { if (!file) return; if (!/\.(csv|json)$/i.test(file.name)) { setError('Envie um arquivo nos formatos CSV ou JSON.'); return }; if (file.name.toLowerCase().endsWith('.json')) { const reader = new FileReader(); reader.onload = () => void processJson(String(reader.result)); reader.readAsText(file); return }; void processCsv(file) }
  const searchIndex = useMemo(() => indexInvoices(results), [results])
  const listing = useMemo(() => queryInvoices(searchIndex, selectedFund, search.cedente, search.sacado), [searchIndex, selectedFund, search])
  const listResults = listing.rows
  const fundOptions = useMemo(() => [...new Map(results.map(item => [item.fundoDocumento || item.fundo, `${item.fundo}${item.fundoDocumento ? ` · ${item.fundoDocumento}` : ''}`])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [results])

  const matchingResults = useMemo(() => listResults.filter((item) => filter === 'todas' || (filter === 'aprovadas' ? item.aprovado : !item.aprovado)), [listResults, filter])
  const totalPages = Math.max(1, Math.ceil(matchingResults.length / PAGE_SIZE))
  const filteredResults = useMemo(() => matchingResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [matchingResults, currentPage])
  const { approved, rejected, totalValue } = listing
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0])
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files[0]) }
  const resetAnalysis = () => {
    setResults([])
    setError('')
    setSelectedFund('')
    setCedenteFilter('')
    setSacadoFilter('')
    setSearch({ cedente: '', sacado: '' })
    setFilter('todas')
    setCurrentPage(1)
    setChartsExpanded(true)
    setActiveView('dashboard')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="app-shell">
      {validatorsOpen && <ValidatorsModal apiUrl={API_URL} onClose={() => setValidatorsOpen(false)} />}
      {selectedInvoice && <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      <header className="topbar"><img className="brand-logo" src={antecipaLogo} alt="antecipa" /><div className="topbar-right"><span className={`api-status ${apiLoading ? 'loading' : apiOnline ? 'online' : 'offline'}`}>{!apiLoading && <span className="live-dot" />} {apiLoading ? 'Conectando à API...' : apiOnline ? 'API conectada' : 'API offline'}</span></div></header>
      <main className="main-content">
        {results.length === 0 && !isLoading && <section className="intro"><div><h1>Validação de notas fiscais</h1><p className="subtitle">Envie o CSV com as Notas Fiscais e o sistema fará a análise</p></div></section>}
        <section className="workspace-grid"><div className="left-column">
          {results.length === 0 && !isLoading && <div className="upload-card"><div className="section-heading"><div><div><h2>Adicione seu arquivo CSV</h2><p>O arquivo deve conter as notas que serão analisadas</p></div></div><div className="upload-actions"><button type="button" className="validators-open" onClick={() => setValidatorsOpen(true)}>Configurar validadores</button></div></div><div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}><input ref={inputRef} type="file" accept=".csv,.json" onChange={onInputChange} hidden /><div className="upload-icon">↑</div><h3>Arraste e solte seu arquivo aqui</h3><p>ou <button className="link-button" type="button">selecione no computador</button></p></div>{error && <div className="error-message">{error}</div>}</div>}
          {!isLoading && results.length > 0 && <>
            <div className="analysis-view-heading"><div><p className="eyebrow">ANÁLISE CONCLUÍDA</p><h1>Resultado da análise</h1><p>Veja o resumo nos gráficos ou consulte cada nota fiscal.</p></div><button type="button" className="new-analysis-button" onClick={resetAnalysis}>Analisar novo CSV</button></div>
            <nav className="analysis-navigation" aria-label="Visualização dos resultados">
              <button type="button" aria-pressed={activeView === 'dashboard'} aria-controls="dashboard-view" onClick={() => setActiveView('dashboard')}><strong>Dashboard</strong><span>Gráficos e comparativo entre fundos</span></button>
              <button type="button" aria-pressed={activeView === 'notas'} aria-controls="invoices-view" onClick={() => setActiveView('notas')}><strong>Notas fiscais <small>{results.length.toLocaleString('pt-BR')}</small></strong><span>Filtros, valores e motivos de recusa</span></button>
            </nav>
          </>}
          {!isLoading && results.length > 0 && <section id="dashboard-view" aria-label="Dashboard" hidden={activeView !== 'dashboard'}>{activeView === 'dashboard' && <><div className="dashboard-view-actions"><p>Use o filtro dos gráficos para explorar um fundo.</p><button type="button" onClick={() => setActiveView('notas')}>Consultar notas deste fundo →</button></div><div className="charts-section"><button type="button" className="charts-toggle" aria-expanded={chartsExpanded} aria-controls="analysis-charts" onClick={() => setChartsExpanded(expanded => !expanded)}><span>{chartsExpanded ? 'Recolher Dashboard ▴' : 'Expandir Dashboard ▾'}</span></button><div id="analysis-charts">{chartsExpanded && <Dashboard rows={results} selectedFund={selectedFund} onFundChange={setSelectedFund} />}</div></div></>}</section>}
          {isLoading ? <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" /><div><strong>Processando seu arquivo</strong><p>Estamos analisando as notas fiscais. Isso pode levar alguns instantes.</p></div></div> : results.length > 0 && <section id="invoices-view" aria-label="Listagem de notas fiscais" hidden={activeView !== 'notas'}>{activeView === 'notas' && <div className="results-section"><div className="results-header"><div><h2>Notas processadas</h2><p className="invoice-table-hint">Clique em uma nota para ver os dados completos.</p></div></div><div className="listing-filters" aria-label="Filtros da listagem">
            <label>Fundo<select value={selectedFund} onChange={event => setSelectedFund(event.target.value)}><option value="">Todos os fundos</option>{fundOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Cedente<input type="search" placeholder="Buscar pelo nome do cedente" value={cedenteFilter} onChange={event => setCedenteFilter(event.target.value)} /></label>
            <label>Sacado<input type="search" placeholder="Buscar pelo nome ou CNPJ" value={sacadoFilter} onChange={event => setSacadoFilter(event.target.value)} /></label>
            <button type="button" disabled={!selectedFund && !cedenteFilter && !sacadoFilter} onClick={() => { setSelectedFund(''); setCedenteFilter(''); setSacadoFilter('') }}>Limpar filtros</button>
          </div><p className="search-feedback" role="status">{cedenteFilter !== search.cedente || sacadoFilter !== search.sacado ? 'Atualizando busca...' : `${listResults.length.toLocaleString('pt-BR')} notas encontradas`}</p><div className="metrics"><div><span>Total analisado</span><strong>{listResults.length}</strong></div><div className="metric-approved"><span>Aprovadas</span><strong>{approved}</strong><small>{listResults.length ? Math.round(approved / listResults.length * 100) : 0}% do lote</small></div><div className="metric-rejected"><span>Reprovadas</span><strong>{rejected}</strong><small>{listResults.length ? Math.round(rejected / listResults.length * 100) : 0}% do lote</small></div><div><span>Valor total</span><strong>{currency.format(totalValue)}</strong></div></div><div className="table-toolbar"><div className="tabs">{(['todas', 'aprovadas', 'reprovadas'] as const).map((tab) => <button key={tab} className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>{tab[0].toUpperCase() + tab.slice(1)} <span>{tab === 'todas' ? listResults.length : tab === 'aprovadas' ? approved : rejected}</span></button>)}</div></div><div className="table-wrap"><table><thead><tr><th>Nota fiscal</th><th>Sacado</th><th>Valor</th><th>Simulação recebível</th><th>Status</th><th>Vencimento</th></tr></thead><tbody>{filteredResults.length ? filteredResults.map((item) => <tr key={`${item.id}-${item.linha ?? item.vencimento}`} className="invoice-row" tabIndex={0} aria-label={`Ver dados completos da nota ${item.id}`} onClick={() => setSelectedInvoice(item)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedInvoice(item) } }}><td><strong>{item.id}</strong><small>{item.tipo}</small><small>Cedente: {item.cedente}</small></td><td><strong>{item.sacado}</strong><small>{item.cnpj || 'CNPJ não informado'}</small></td><td>{currency.format(item.valor)}</td><td>{item.precificacao ? <div className="simulation"><strong>{currency.format(item.precificacao.valor_liquido)}</strong><small>líquido · desconto {currency.format(item.precificacao.valor_desconto)}</small></div> : '—'}</td><td><span className={`status ${item.aprovado ? 'approved' : 'rejected'}`}><span />{item.aprovado ? 'Aprovada' : 'Reprovada'}</span></td><td>{item.vencimento ? item.vencimento.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') : '—'}</td></tr>) : <tr><td className="empty-state" colSpan={6}>Nenhuma nota encontrada para este filtro.</td></tr>}</tbody></table></div></div>}</section>}
          {!isLoading && results.length > 0 && activeView === 'notas' && <div className="pagination" aria-label="Paginação das notas processadas"><span>{matchingResults.length ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, matchingResults.length)} de ${matchingResults.length}` : '0 notas'}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Anterior</button><strong>Página {currentPage} de {totalPages}</strong><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Próxima</button></div></div>}
        </div></section>
      </main>
    </div>
  )
}

export default App
