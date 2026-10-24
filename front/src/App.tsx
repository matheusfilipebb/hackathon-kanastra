import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import antecipaLogo from './assets/antecipe-logo-branco-sem-fundo.svg'

type Invoice = { id: string; sacado: string; cnpj: string; valor: number; vencimento: string; tipo: string; situacao: string; cedente: string }
type Result = Invoice & { aprovado: boolean; motivos: string[] }
type ApiResult = { linha: number; id: string; status: 'APROVADO' | 'BARRADO'; barrado_por?: string[] }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://10.12.156.120:3000'
const REQUIRED_CSV_HEADERS = ['NOME_FUNDO', 'DOC_FUNDO', 'NOME_CEDENTE', 'DOC_CEDENTE', 'NOME_SACADO', 'DOC_SACADO', 'NU_DOCUMENTO', 'TIPO_RECEBIVEL', 'VALOR_NOMINAL', 'DATA_VENCIMENTO_ORIGINAL', 'DATA_AQUISICAO']

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function normalizeInvoice(item: Record<string, unknown>, index: number): Invoice {
  const get = (...keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== '')
  const rawValue = get('valor', 'valor_face', 'valor_nominal')
  const valueText = String(rawValue ?? '0').replace(/[^\d,.-]/g, '')
  const parsedValue = typeof rawValue === 'number' ? rawValue : Number(valueText.includes(',') ? valueText.replace(/\./g, '').replace(',', '.') : valueText)
  return { id: String(get('id', 'numero', 'nota', 'numero_nf') ?? `NF-${String(index + 1).padStart(4, '0')}`), sacado: String(get('sacado', 'nome_sacado', 'sacado_nome') ?? 'Sacado não informado'), cnpj: String(get('cnpj', 'cnpj_sacado', 'documento_sacado') ?? ''), valor: Number.isNaN(parsedValue) ? 0 : parsedValue, vencimento: String(get('vencimento', 'data_vencimento') ?? ''), tipo: String(get('tipo', 'tipo_recebivel') ?? 'Duplicata'), situacao: String(get('situacao', 'situacao_cadastral', 'status') ?? 'ATIVA').toUpperCase(), cedente: String(get('cedente', 'nome_cedente') ?? 'Cedente não informado') }
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
  const [results, setResults] = useState<Result[]>([])
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'aprovadas' | 'reprovadas'>('todas')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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
  }, [])
  const processJson = async (text: string, name: string) => {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed) && parsed?.fundo && Array.isArray(parsed?.validadores) && parsed?.precificacao) {
        setIsLoading(true)
        const response = await fetch(`${API_URL}/validadores`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
        const responseBody = await response.json().catch(() => null)
        if (!response.ok) throw new Error(responseBody?.message ?? `A API respondeu com status ${response.status}.`)
        setFileName(name); setApiOnline(true); setError(''); return
      }
      const rows = Array.isArray(parsed) ? parsed : parsed.notas_fiscais ?? parsed.notas ?? parsed.data ?? []
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('JSON inválido. Envie uma lista de notas ou a configuração completa dos validadores.')
      setResults(evaluate(rows.map((item, index) => normalizeInvoice(item, index)))); setFileName(name); setError('')
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
      setResults(apiRows.map((item) => { const local = localRows[item.linha - 2] ?? localRows.find((row) => row.id === item.id); return { ...(local ?? { id: item.id, sacado: 'Dados retornados pela API', cnpj: '', valor: 0, vencimento: '', tipo: '', situacao: '', cedente: '' }), aprovado: item.status === 'APROVADO', motivos: item.barrado_por ?? [] } }))
      setFileName(file.name); setApiOnline(true)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível analisar o CSV na API.'); setApiOnline(false) } finally { setIsLoading(false) }
  }
  const handleFile = (file?: File) => { if (!file) return; if (!/\.(csv|json)$/i.test(file.name)) { setError('Envie um arquivo nos formatos CSV ou JSON.'); return }; if (file.name.toLowerCase().endsWith('.json')) { const reader = new FileReader(); reader.onload = () => void processJson(String(reader.result), file.name); reader.readAsText(file); return }; void processCsv(file) }
  const filteredResults = useMemo(() => results.filter((item) => filter === 'todas' || (filter === 'aprovadas' ? item.aprovado : !item.aprovado)), [results, filter])
  const approved = results.filter((item) => item.aprovado).length; const rejected = results.length - approved; const totalValue = results.reduce((sum, item) => sum + item.valor, 0)
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0])
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files[0]) }

  return (
    <div className="app-shell">
      <header className="topbar"><img className="brand-logo" src={antecipaLogo} alt="antecipa" /><div className="topbar-right"><span className={`live-dot ${apiOnline ? '' : 'offline'}`} /> {apiOnline ? 'API conectada' : 'API offline'}</div></header>
      <main className="main-content">
        <section className="intro"><div><p className="eyebrow">OPERAÇÃO · ANÁLISE DE RECEBÍVEIS</p><h1>Validação de notas fiscais</h1><p className="subtitle">Envie seu lote e deixe os validadores fazerem o trabalho pesado.</p></div></section>
        <section className="workspace-grid"><div className="left-column">
          <div className="upload-card"><div className="section-heading"><div><span className="step">01</span><div><h2>Adicione seu arquivo</h2><p>O arquivo deve conter as notas que serão analisadas.</p></div></div><span className="format-label">CSV / JSON</span></div><div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}><input ref={inputRef} type="file" accept=".csv,.json" onChange={onInputChange} hidden /><div className="upload-icon">↑</div><h3>{isLoading ? 'Analisando arquivo na API...' : 'Arraste e solte seu arquivo aqui'}</h3><p>ou <button className="link-button" type="button">selecione no computador</button></p><small>Máximo de 50 MiB · CSV ou JSON</small></div>{error && <div className="error-message">{error}</div>}{fileName && <div className="file-loaded"><span className="file-type">{fileName.endsWith('.json') ? '{ }' : 'CSV'}</span><div><strong>{fileName}</strong><span>{isLoading ? 'Enviando para a API...' : 'Arquivo pronto para análise'}</span></div><span className="file-check">✓</span></div>}</div>
          <div className="results-section"><div className="results-header"><div><p className="eyebrow">02 · RESULTADO DA ANÁLISE</p><h2>Notas processadas</h2></div><span className="processed-label"><span className="pulse" /> {results.length ? 'Processamento concluído' : 'Aguardando arquivo'}</span></div><div className="metrics"><div><span>Total analisado</span><strong>{results.length}</strong></div><div className="metric-approved"><span>Aprovadas</span><strong>{approved}</strong><small>{results.length ? Math.round(approved / results.length * 100) : 0}% do lote</small></div><div className="metric-rejected"><span>Reprovadas</span><strong>{rejected}</strong><small>{results.length ? Math.round(rejected / results.length * 100) : 0}% do lote</small></div><div><span>Valor total</span><strong>{currency.format(totalValue)}</strong></div></div><div className="table-toolbar"><div className="tabs">{(['todas', 'aprovadas', 'reprovadas'] as const).map((tab) => <button key={tab} className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>{tab[0].toUpperCase() + tab.slice(1)} <span>{tab === 'todas' ? results.length : tab === 'aprovadas' ? approved : rejected}</span></button>)}</div></div><div className="table-wrap"><table><thead><tr><th>Nota fiscal</th><th>Sacado</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Motivo</th></tr></thead><tbody>{filteredResults.length ? filteredResults.map((item) => <tr key={`${item.id}-${item.vencimento}`}><td><strong>{item.id}</strong><small>{item.tipo}</small></td><td><strong>{item.sacado}</strong><small>{item.cnpj || 'CNPJ não informado'}</small></td><td>{currency.format(item.valor)}</td><td>{item.vencimento ? new Date(`${item.vencimento}T00:00:00`).toLocaleDateString('pt-BR') : '—'}</td><td><span className={`status ${item.aprovado ? 'approved' : 'rejected'}`}><span />{item.aprovado ? 'Aprovada' : 'Reprovada'}</span></td><td className="reason">{item.aprovado ? 'Todos os critérios atendidos' : item.motivos[0]}</td></tr>) : <tr><td className="empty-state" colSpan={6}>Envie um arquivo para exibir as notas processadas.</td></tr>}</tbody></table></div></div>
        </div></section>
      </main><footer><span>Antecipe · Motor de análise de recebíveis</span><span>Última sincronização: agora</span></footer>
    </div>
  )
}

export default App
