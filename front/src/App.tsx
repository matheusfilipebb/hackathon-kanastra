import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react'
import './App.css'

type Invoice = { id: string; sacado: string; cnpj: string; valor: number; vencimento: string; tipo: string; situacao: string; cedente: string }
type Result = Invoice & { aprovado: boolean; motivos: string[] }

const validators = [
  { code: 'CNPJ_SACADO_VALIDO', label: 'CNPJ do sacado válido', active: true },
  { code: 'SITUACAO_CADASTRAL_SACADO', label: 'Sacado com situação ativa', active: true },
  { code: 'TIPO_RECEBIVEL', label: 'Tipo de recebível aceito', active: true },
  { code: 'VALOR_MINIMO', label: 'Valor mínimo de R$ 100', active: true },
  { code: 'NAO_VENCIDA', label: 'Nota não vencida', active: true },
  { code: 'PRAZO_MAXIMO', label: 'Prazo máximo de 180 dias', active: true },
  { code: 'CONCENTRACAO_MAXIMA_SACADO', label: 'Concentração por sacado até 10%', active: true },
  { code: 'PRAZO_MINIMO', label: 'Prazo mínimo de 30 dias', active: false },
]

const sampleInvoices: Invoice[] = [
  { id: 'NF-2024-0018', sacado: 'Mercado Pinheiros Ltda.', cnpj: '12.345.678/0001-90', valor: 18450, vencimento: '2024-12-18', tipo: 'Duplicata', situacao: 'ATIVA', cedente: 'Distribuidora Aurora' },
  { id: 'NF-2024-0019', sacado: 'Construtora Horizonte S.A.', cnpj: '45.678.901/0001-22', valor: 7620, vencimento: '2025-02-02', tipo: 'Duplicata de Serviço', situacao: 'ATIVA', cedente: 'Engenharia Norte' },
  { id: 'NF-2024-0020', sacado: 'Oficina Central ME', cnpj: '98.765.432/0001-11', valor: 86, vencimento: '2025-01-30', tipo: 'Duplicata', situacao: 'ATIVA', cedente: 'Auto Peças Brasil' },
  { id: 'NF-2024-0021', sacado: 'Clínica Vida Plena', cnpj: '11.222.333/0001-44', valor: 4250, vencimento: '2024-10-02', tipo: 'Nota de débito', situacao: 'ATIVA', cedente: 'Saúde Integrada' },
  { id: 'NF-2024-0022', sacado: 'Mercado Pinheiros Ltda.', cnpj: '12.345.678/0001-90', valor: 9200, vencimento: '2025-03-10', tipo: 'Duplicata', situacao: 'ATIVA', cedente: 'Atacado São Paulo' },
]

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function normalizeInvoice(item: Record<string, unknown>, index: number): Invoice {
  const get = (...keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== '')
  const rawValue = get('valor', 'valor_face', 'valor_nominal')
  const parsedValue = typeof rawValue === 'number' ? rawValue : Number(String(rawValue ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.'))
  return { id: String(get('id', 'numero', 'nota', 'numero_nf') ?? `NF-${String(index + 1).padStart(4, '0')}`), sacado: String(get('sacado', 'nome_sacado', 'sacado_nome') ?? 'Sacado não informado'), cnpj: String(get('cnpj', 'cnpj_sacado', 'documento_sacado') ?? ''), valor: Number.isNaN(parsedValue) ? 0 : parsedValue, vencimento: String(get('vencimento', 'data_vencimento') ?? ''), tipo: String(get('tipo', 'tipo_recebivel') ?? 'Duplicata'), situacao: String(get('situacao', 'situacao_cadastral', 'status') ?? 'ATIVA').toUpperCase(), cedente: String(get('cedente', 'nome_cedente') ?? 'Cedente não informado') }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(delimiter).map((header) => header.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, (line.split(delimiter)[index] ?? '').trim().replace(/^['"]|['"]$/g, '')])))
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
  const [results, setResults] = useState<Result[]>(evaluate(sampleInvoices))
  const [fileName, setFileName] = useState('lote_notas_dezembro.csv')
  const [isDragging, setIsDragging] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'aprovadas' | 'reprovadas'>('todas')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const processText = (text: string, name: string) => { try { const parsed = name.toLowerCase().endsWith('.csv') ? parseCsv(text) : JSON.parse(text); const rows = Array.isArray(parsed) ? parsed : parsed.notas_fiscais ?? parsed.notas ?? parsed.data ?? []; if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nenhuma nota fiscal encontrada no arquivo.'); setResults(evaluate(rows.map((item, index) => normalizeInvoice(item, index)))); setFileName(name); setError('') } catch (fileError) { setError(fileError instanceof Error ? fileError.message : 'Não foi possível ler este arquivo.') } }
  const handleFile = (file?: File) => { if (!file) return; if (!/\.(csv|json)$/i.test(file.name)) { setError('Envie um arquivo nos formatos CSV ou JSON.'); return }; const reader = new FileReader(); reader.onload = () => processText(String(reader.result), file.name); reader.readAsText(file) }
  const filteredResults = useMemo(() => results.filter((item) => filter === 'todas' || (filter === 'aprovadas' ? item.aprovado : !item.aprovado)), [results, filter])
  const approved = results.filter((item) => item.aprovado).length; const rejected = results.length - approved; const totalValue = results.reduce((sum, item) => sum + item.valor, 0)
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0])
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files[0]) }

  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">≋</span><span>valida<span className="brand-accent">.ai</span></span></div><div className="topbar-right"><span className="live-dot" /> API conectada <span className="avatar">AM</span></div></header>
      <main className="main-content">
        <section className="intro"><div><p className="eyebrow">OPERAÇÃO · ANÁLISE DE RECEBÍVEIS</p><h1>Validação de notas fiscais</h1><p className="subtitle">Envie seu lote e deixe os validadores fazerem o trabalho pesado.</p></div><div className="fund-badge"><span className="fund-icon">A</span><div><small>FUNDO ATIVO</small><strong>ANTECIPE FIDC</strong><span>CNPJ 92.234.400/0001-80</span></div><span className="chevron">⌄</span></div></section>
        <section className="workspace-grid"><div className="left-column">
          <div className="upload-card"><div className="section-heading"><div><span className="step">01</span><div><h2>Adicione seu arquivo</h2><p>O arquivo deve conter as notas que serão analisadas.</p></div></div><span className="format-label">CSV / JSON</span></div><div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}><input ref={inputRef} type="file" accept=".csv,.json" onChange={onInputChange} hidden /><div className="upload-icon">↑</div><h3>Arraste e solte seu arquivo aqui</h3><p>ou <button className="link-button" type="button">selecione no computador</button></p><small>Máximo de 10 MB · CSV ou JSON</small></div>{error && <div className="error-message">{error}</div>}<div className="file-loaded"><span className="file-type">{fileName.endsWith('.json') ? '{ }' : 'CSV'}</span><div><strong>{fileName}</strong><span>Arquivo pronto para análise</span></div><span className="file-check">✓</span></div></div>
          <div className="results-section"><div className="results-header"><div><p className="eyebrow">02 · RESULTADO DA ANÁLISE</p><h2>Notas processadas</h2></div><span className="processed-label"><span className="pulse" /> Processamento concluído</span></div><div className="metrics"><div><span>Total analisado</span><strong>{results.length}</strong></div><div className="metric-approved"><span>Aprovadas</span><strong>{approved}</strong><small>{results.length ? Math.round(approved / results.length * 100) : 0}% do lote</small></div><div className="metric-rejected"><span>Reprovadas</span><strong>{rejected}</strong><small>{results.length ? Math.round(rejected / results.length * 100) : 0}% do lote</small></div><div><span>Valor total</span><strong>{currency.format(totalValue)}</strong></div></div><div className="table-toolbar"><div className="tabs">{(['todas', 'aprovadas', 'reprovadas'] as const).map((tab) => <button key={tab} className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>{tab[0].toUpperCase() + tab.slice(1)} <span>{tab === 'todas' ? results.length : tab === 'aprovadas' ? approved : rejected}</span></button>)}</div><button className="outline-button" onClick={() => setResults(evaluate(sampleInvoices))}>↻ <span>Atualizar análise</span></button></div><div className="table-wrap"><table><thead><tr><th>Nota fiscal</th><th>Sacado</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Motivo</th></tr></thead><tbody>{filteredResults.map((item) => <tr key={item.id}><td><strong>{item.id}</strong><small>{item.tipo}</small></td><td><strong>{item.sacado}</strong><small>{item.cnpj || 'CNPJ não informado'}</small></td><td>{currency.format(item.valor)}</td><td>{item.vencimento ? new Date(`${item.vencimento}T00:00:00`).toLocaleDateString('pt-BR') : '—'}</td><td><span className={`status ${item.aprovado ? 'approved' : 'rejected'}`}><span />{item.aprovado ? 'Aprovada' : 'Reprovada'}</span></td><td className="reason">{item.aprovado ? 'Todos os critérios atendidos' : item.motivos[0]}</td></tr>)}</tbody></table></div></div>
        </div><aside className="rules-card"><div className="rules-title"><div><p className="eyebrow">CONFIGURAÇÃO</p><h2>Validadores ativos</h2></div><span className="count-badge">{validators.filter((item) => item.active).length}/{validators.length}</span></div><p className="rules-description">Critérios aplicados pela API nesta análise.</p><div className="rules-list">{validators.map((item) => <div className={`rule ${!item.active ? 'inactive' : ''}`} key={item.code}><span className="rule-check">{item.active ? '✓' : '–'}</span><div><strong>{item.label}</strong><small>{item.code}</small></div><span className={`rule-state ${item.active ? '' : 'off'}`}>{item.active ? 'ativo' : 'inativo'}</span></div>)}</div><div className="pricing"><span className="pricing-icon">%</span><div><small>PRECIFICAÇÃO</small><strong>Desconto simples · 2,00% a.m.</strong></div></div></aside></section>
      </main><footer><span>valida.ai · Motor de análise de recebíveis</span><span>Última sincronização: agora</span></footer>
    </div>
  )
}

export default App
