import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './Landing.css'
import './RejectionReasons.css'
import './InvoicesView.css'
import RejectionPreview from './RejectionPreview'
import { LandingIntro, OperationSteps } from './Landing'
import Dashboard from './Dashboard'
import AnalysisNavigation from './AnalysisNavigation'
import { requestApi, uploadCsv } from './api'
import { useApiHealth } from './useApiHealth'
import type { UploadProgress } from './api'
import UploadLoading from './UploadLoading'
import { indexInvoices, queryInvoices } from './listing'
import ValidatorsModal from './ValidatorsModal'
import InvoiceModal from './InvoiceModal'
import antecipaLogo from './assets/antecipe-logo-branco-sem-fundo.svg'
import antecipeLogoGreen from './assets/antecipe-logo-verde-sem-fundo.svg'

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
  const [headerScrolled, setHeaderScrolled] = useState(() => window.scrollY > 48)
  const [activeView, setActiveView] = useState<'dashboard' | 'notas'>('notas')
  const [search, setSearch] = useState({ cedente: '', sacado: '' })
  const [selectedFund, setSelectedFund] = useState('')
  const [cedenteFilter, setCedenteFilter] = useState('')
  const [sacadoFilter, setSacadoFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [validatorsOpen, setValidatorsOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Result | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'aprovadas' | 'reprovadas'>('todas')
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [uploadStartedAt, setUploadStartedAt] = useState(0)
  const [estimatedProcessingMs, setEstimatedProcessingMs] = useState<number | null>(null)
  const lastAnalysis = useRef<{ bytes: number; ms: number } | null>(null)
  const { loading: apiLoading, online: apiOnline } = useApiHealth(API_URL)
  const inputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const processingFile = useRef(false)
  useEffect(() => {
    let frame = 0
    const updateHeader = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        setHeaderScrolled(window.scrollY > 48)
        frame = 0
      })
    }
    window.addEventListener('scroll', updateHeader, { passive: true })
    updateHeader()
    return () => {
      window.removeEventListener('scroll', updateHeader)
      window.cancelAnimationFrame(frame)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch({ cedente: cedenteFilter, sacado: sacadoFilter }), 200)
    return () => window.clearTimeout(timer)
  }, [cedenteFilter, sacadoFilter])
  useEffect(() => { setCurrentPage(1) }, [filter, results, selectedFund, search])
  useEffect(() => { if (tableRef.current) tableRef.current.scrollTop = 0 }, [currentPage, filter, selectedFund, search])
  const processJson = async (text: string) => {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed) && parsed?.fundo && Array.isArray(parsed?.validadores) && parsed?.precificacao) {
        setIsLoading(true)
        const response = await requestApi(`${API_URL}/validadores`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
        const responseBody = await response.json().catch(() => null)
        if (!response.ok) throw new Error(responseBody?.message ?? `A API respondeu com status ${response.status}.`)
        setCurrentPage(1); setError(''); return
      }
      const rows = Array.isArray(parsed) ? parsed : parsed.notas_fiscais ?? parsed.notas ?? parsed.data ?? []
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('JSON inválido. Envie uma lista de notas ou a configuração completa dos validadores.')
      setSelectedFund(''); setCedenteFilter(''); setSacadoFilter(''); setResults(evaluate(rows.map((item, index) => normalizeInvoice(item, index)))); setCurrentPage(1); setError('')
    } catch (fileError) { setError(fileError instanceof Error ? fileError.message : 'Não foi possível ler este arquivo.') } finally { setIsLoading(false); processingFile.current = false }
  }
  const processCsv = async (file: File) => {
    const startedAt = Date.now()
    setUploadStartedAt(startedAt)
    setUploadProgress({ stage: 'preparing', loaded: 0, total: 0, stageStartedAt: startedAt })
    setEstimatedProcessingMs(lastAnalysis.current ? Math.max(1000, lastAnalysis.current.ms * file.size / lastAnalysis.current.bytes) : Math.max(2000, 10000 * file.size / (20 * 1024 * 1024)))
    setIsLoading(true); setError('')
    try {
      const csvText = await file.text(); validateApiCsv(csvText)
      const localRows = parseCsv(csvText).map((item, index) => normalizeInvoice(item, index))
      let analysisStartedAt = 0
      let analysisMs = 0
      const response = await uploadCsv(`${API_URL}/recebiveis/upload`, file, progress => {
        if (progress.stage === 'processing') analysisStartedAt = progress.stageStartedAt
        if (progress.stage === 'receiving' && analysisStartedAt) analysisMs = progress.stageStartedAt - analysisStartedAt
        setUploadProgress(progress)
      })
      if (!response.ok) { const detail = await response.json().catch(() => null); throw new Error(detail?.message ?? `A API respondeu com status ${response.status}.`) }
      const apiRows = await response.json() as ApiResult[]
      if (!Array.isArray(apiRows)) throw new Error('A API retornou um resultado inválido. Tente enviar o arquivo novamente.')
      setSelectedFund(''); setCedenteFilter(''); setSacadoFilter('')
      setResults(apiRows.map((item) => { const local = localRows[item.linha - 2] ?? localRows.find((row) => row.id === item.id); return { ...(local ?? { fundo: 'Fundo não informado', fundoDocumento: '', id: item.id, sacado: 'Dados retornados pela API', cnpj: '', valor: 0, vencimento: '', tipo: '', situacao: '', cedente: '' }), linha: item.linha, aprovado: item.status === 'APROVADO', motivos: item.barrado_por ?? [], precificacao: item.precificacao } }))
      if (analysisMs > 0 && file.size > 0) lastAnalysis.current = { bytes: file.size, ms: analysisMs }
      setCurrentPage(1)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível analisar o CSV na API.') } finally { setIsLoading(false); setUploadProgress(null); processingFile.current = false }
  }
  const handleFile = (file?: File) => {
    if (!file || processingFile.current) return
    if (!/\.(csv|json)$/i.test(file.name)) { setError('Envie um arquivo nos formatos CSV ou JSON.'); return }
    if (file.size > 50 * 1024 * 1024) { setError('O arquivo deve ter no máximo 50 MiB.'); return }
    processingFile.current = true
    if (file.name.toLowerCase().endsWith('.json')) {
      const reader = new FileReader()
      reader.onload = () => void processJson(String(reader.result))
      reader.onerror = () => { processingFile.current = false; setError('Não foi possível ler o arquivo. Tente selecioná-lo novamente.') }
      reader.readAsText(file)
      return
    }
    void processCsv(file)
  }

  const searchIndex = useMemo(() => indexInvoices(results), [results])
  const listing = useMemo(() => queryInvoices(searchIndex, selectedFund, search.cedente, search.sacado), [searchIndex, selectedFund, search])
  const listResults = listing.rows
  const fundOptions = useMemo(() => [...new Map(results.map(item => [item.fundoDocumento || item.fundo, `${item.fundo}${item.fundoDocumento ? ` · ${item.fundoDocumento}` : ''}`])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [results])

  const matchingResults = useMemo(() => listResults.filter((item) => filter === 'todas' || (filter === 'aprovadas' ? item.aprovado : !item.aprovado)), [listResults, filter])
  const totalPages = Math.max(1, Math.ceil(matchingResults.length / PAGE_SIZE))
  const filteredResults = useMemo(() => matchingResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [matchingResults, currentPage])
  const { approved, rejected, totalValue } = listing
  const activeFilterCount = Number(Boolean(selectedFund)) + Number(Boolean(cedenteFilter.trim())) + Number(Boolean(sacadoFilter.trim()))
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; handleFile(file) }
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files[0]) }
  const resetAnalysis = () => {
    setResults([])
    setError('')
    setSelectedFund('')
    setFiltersOpen(false)
    setCedenteFilter('')
    setSacadoFilter('')
    setSearch({ cedente: '', sacado: '' })
    setFilter('todas')
    setCurrentPage(1)
    setActiveView('notas')
    if (inputRef.current) inputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  const changeView = (view: 'notas' | 'dashboard') => {
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <div className={`app-shell${!isLoading && results.length > 0 ? ` app-shell--results${activeView === 'notas' ? ' app-shell--notes' : ' app-shell--dashboard'}` : ''}`}>
      {validatorsOpen && <ValidatorsModal apiUrl={API_URL} onClose={() => setValidatorsOpen(false)} />}
      {selectedInvoice && <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      {!isLoading && results.length > 0 && <AnalysisNavigation activeView={activeView} total={results.length} onViewChange={changeView} onNewAnalysis={resetAnalysis} />}
      {results.length === 0 && !isLoading && <header className={`topbar${headerScrolled ? ' topbar--solid' : ''}`}>
        <div className="brand-lockup">
          <img className="brand-logo brand-logo--light" src={antecipaLogo} alt="Antecipe" />
          <img className="brand-logo brand-logo--dark" src={antecipeLogoGreen} alt="" aria-hidden="true" />
        </div>
        <nav className="product-nav" aria-label="Navegação principal">
          <a href="#analise">Analisar carteira</a><a href="#como-funciona">Como funciona</a>
          <button type="button" onClick={() => setValidatorsOpen(true)}>Regras da operação</button>
        </nav>
        <div className="topbar-right"><span role="status" className={`api-status ${apiLoading ? 'loading' : apiOnline ? 'online' : 'offline'}`}><span className="live-dot" />{apiLoading ? 'Conectando…' : apiOnline ? 'Sistema disponível' : 'Sistema indisponível'}</span></div>
      </header>}
      <main className="main-content">
        {results.length === 0 && !isLoading && <LandingIntro />}
        <section className="workspace-grid"><div className="left-column">
          {results.length === 0 && !isLoading && <div className="upload-card" id="analise"><div className="section-heading"><div><span className="step">01</span><div><p className="eyebrow">COMECE POR AQUI</p><h2>Analise sua carteira de recebíveis</h2><p>Envie um arquivo para validar notas e consultar a precificação sugerida.</p></div></div><div className="upload-actions"><button type="button" className="validators-open" onClick={() => setValidatorsOpen(true)}>Configurar regras <span aria-hidden="true">↗</span></button></div></div><div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onClick={event => { if (event.target !== inputRef.current) inputRef.current?.click() }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}><input ref={inputRef} type="file" accept=".csv,.json" onChange={onInputChange} hidden /><div className="upload-icon">↑</div><h3>Arraste e solte seu arquivo aqui</h3><p>ou <button className="link-button" type="button" onClick={event => { event.stopPropagation(); inputRef.current?.click() }}>selecione no computador</button></p><small>CSV ou JSON · até 50 MiB</small></div>{error && <div className="error-message" role="alert">{error}</div>}<div className="upload-footnote" id="seguranca"><span className="shield-icon">✓</span><p><strong>Seus dados, sob controle.</strong><br />A análise segue os validadores configurados para sua operação.</p><button type="button" onClick={() => setValidatorsOpen(true)}>Revisar regras <span aria-hidden="true">→</span></button></div></div>}
          {!isLoading && results.length > 0 && <section id="dashboard-view" aria-label="Dashboard" hidden={activeView !== 'dashboard'}>{activeView === 'dashboard' && <Dashboard rows={results} selectedFund={selectedFund} onFundChange={setSelectedFund} />}</section>}
          {isLoading ? (uploadProgress ? <UploadLoading progress={uploadProgress} startedAt={uploadStartedAt} estimatedProcessingMs={estimatedProcessingMs} /> : <div className="loading-state" role="status"><span className="loading-spinner" /><strong>Salvando configuração...</strong></div>) : results.length > 0 && <section id="invoices-view" aria-label="Listagem de notas fiscais" hidden={activeView !== 'notas'}>{activeView === 'notas' && <div className="results-section"><div className={`results-controls${filtersOpen ? ' results-controls--filters-open' : ''}`}><div className="results-header"><div><h2>Notas processadas</h2><p className="invoice-table-hint">Abra uma nota para ver os detalhes.</p></div></div><button type="button" className={`results-filters-toggle${activeFilterCount ? ' has-active-filters' : ''}`} aria-label={activeFilterCount ? `Filtros: ${activeFilterCount} ${activeFilterCount === 1 ? 'ativo' : 'ativos'}` : 'Filtros'} aria-expanded={filtersOpen} aria-controls="invoices-filters" onClick={() => setFiltersOpen(open => !open)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            <span className="filters-toggle-label">Filtros</span> {activeFilterCount > 0 && <span className="active-filter-count" aria-hidden="true">{activeFilterCount}</span>}
            <svg className="filters-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </button><div id="invoices-filters" className="listing-filters" aria-label="Filtros da listagem" hidden={!filtersOpen}>
            <label>Fundo<select value={selectedFund} onChange={event => setSelectedFund(event.target.value)}><option value="">Todos os fundos</option>{fundOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Cedente<input type="search" placeholder="Buscar pelo nome do cedente" value={cedenteFilter} onChange={event => setCedenteFilter(event.target.value)} /></label>
            <label>Sacado<input type="search" placeholder="Buscar pelo nome ou CNPJ" value={sacadoFilter} onChange={event => setSacadoFilter(event.target.value)} /></label>
            <button type="button" disabled={!selectedFund && !cedenteFilter && !sacadoFilter} onClick={() => { setSelectedFund(''); setCedenteFilter(''); setSacadoFilter('') }}>Limpar filtros</button>
          </div><div className="metrics"><div><span>Total analisado</span><strong>{listResults.length.toLocaleString('pt-BR')}</strong></div><div className="metric-approved"><span>Aprovadas</span><strong>{approved.toLocaleString('pt-BR')}</strong><small>{listResults.length ? Math.round(approved / listResults.length * 100) : 0}% do lote</small></div><div className="metric-rejected"><span>Não aprovadas</span><strong>{rejected.toLocaleString('pt-BR')}</strong><small>{listResults.length ? Math.round(rejected / listResults.length * 100) : 0}% do lote</small></div><div><span>Valor total</span><strong>{currency.format(totalValue)}</strong></div></div></div><div className="results-table-panel"><div className="table-toolbar"><div className="tabs">{(['todas', 'aprovadas', 'reprovadas'] as const).map((tab) => <button key={tab} className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>{tab === 'reprovadas' ? 'Não aprovadas' : tab[0].toUpperCase() + tab.slice(1)} <span>{(tab === 'todas' ? listResults.length : tab === 'aprovadas' ? approved : rejected).toLocaleString('pt-BR')}</span></button>)}</div><p className="search-feedback" role="status">{cedenteFilter !== search.cedente || sacadoFilter !== search.sacado ? 'Atualizando busca...' : `${matchingResults.length.toLocaleString('pt-BR')} notas encontradas`}</p></div><div ref={tableRef} className="table-wrap" role="region" aria-label="Tabela de notas fiscais" tabIndex={0}><table><thead><tr><th>Nota fiscal</th><th>Sacado</th><th>Valor</th><th>Simulação recebível</th><th>Status</th><th>Motivo da não aprovação</th><th>Vencimento</th></tr></thead><tbody>{filteredResults.length ? filteredResults.map((item) => <tr key={`${item.id}-${item.linha ?? item.vencimento}`} className="invoice-row" tabIndex={0} aria-label={`Ver dados completos da nota ${item.id}`} onClick={() => setSelectedInvoice(item)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedInvoice(item) } }}><td><strong>{item.id}</strong><small>{item.tipo}</small><small>Cedente: {item.cedente}</small></td><td><strong>{item.sacado}</strong><small>{item.cnpj || 'CNPJ não informado'}</small></td><td>{currency.format(item.valor)}</td><td>{item.precificacao ? <div className="simulation"><strong>{currency.format(item.precificacao.valor_liquido)}</strong><small>líquido · desconto {currency.format(item.precificacao.valor_desconto)}</small></div> : '—'}</td><td><span className={`status ${item.aprovado ? 'approved' : 'rejected'}`}><span />{item.aprovado ? 'Aprovada' : 'Não aprovada'}</span></td><td className="reason-cell">{item.aprovado ? <span className="reason-passed">Todos os critérios atendidos</span> : <RejectionPreview invoiceId={item.id} reasons={item.motivos} onOpen={() => setSelectedInvoice(item)} />}</td><td>{item.vencimento ? item.vencimento.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') : '—'}</td></tr>) : <tr><td className="empty-state" colSpan={7}>Nenhuma nota encontrada para este filtro.</td></tr>}</tbody></table></div><div className="pagination" aria-label="Paginação das notas processadas"><span>{matchingResults.length ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, matchingResults.length)} de ${matchingResults.length}` : '0 notas'}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Anterior</button><strong>Página {currentPage} de {totalPages}</strong><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Próxima</button></div></div></div></div>}</section>}

        </div></section>
        {results.length === 0 && !isLoading && <OperationSteps />}
      </main>
      <footer className="app-footer"><span><strong>Antecipe.</strong> Inteligência para sua carteira de recebíveis.</span>{!isLoading && <a href="#analise" onClick={results.length > 0 ? resetAnalysis : undefined}>Iniciar uma análise ↗</a>}</footer>
    </div>
  )
}

export default App
