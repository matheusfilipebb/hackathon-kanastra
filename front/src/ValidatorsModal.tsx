import { useModalBackdrop } from './useModalBackdrop'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { normalizedConfiguration, parameterLabels, parameterSummary, ruleInfo, validateEditor } from './validatorEditor'
import type { Configuration, EditorIssue, EditorTab } from './validatorEditor'
import './ValidatorsModal.css'

const tabs: { id: EditorTab; label: string }[] = [{ id: 'fund', label: 'Fundo' }, { id: 'rules', label: 'Elegibilidade' }, { id: 'pricing', label: 'Precificação' }]
const types = ['Duplicata', 'Duplicata de Serviço', 'Cheque', 'CCB', 'Nota Comercial']
const statuses = ['ATIVA', 'BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA']
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
async function readResponse(response: Response): Promise<Configuration> {
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message ?? `Não foi possível concluir a solicitação (${response.status}).`)
  if (!body?.fundo || !Array.isArray(body.validadores) || !body.precificacao) throw new Error('A API retornou uma configuração inválida.')
  return body
}
export default function ValidatorsModal({ apiUrl, onClose }: { apiUrl: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [configuration, setConfiguration] = useState<Configuration | null>(null)
  const [baseline, setBaseline] = useState('')
  const [tab, setTab] = useState<EditorTab>('rules')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [issue, setIssue] = useState<EditorIssue | null>(null)
  const [success, setSuccess] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const backdrop = useModalBackdrop(onClose, saving)
  const id = useId()
  const dirty = configuration !== null && JSON.stringify(configuration) !== baseline
  const active = configuration?.validadores.filter(rule => rule.ativo).length ?? 0
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch(`${apiUrl}/validadores`, { signal: controller.signal }).then(readResponse).then(config => {
      if (controller.signal.aborted) return
      setConfiguration(config); setBaseline(JSON.stringify(config))
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof TypeError ? 'Não foi possível conectar à API. Confira a conexão e tente novamente.' : reason instanceof Error ? reason.message : 'Não foi possível carregar as regras. Confira a conexão e tente novamente.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [apiUrl, attempt])
  useEffect(() => { if (body.current) body.current.scrollTop = 0 }, [tab])
  useEffect(() => {
    if (!issue) return
    const field = dialog.current?.querySelector<HTMLElement>(`[data-field="${issue.field}"]`)
    field?.focus()
    field?.scrollIntoView({ block: 'nearest' })
  }, [issue, expanded, tab])
  const edit = (config: Configuration) => { setConfiguration(config); setSuccess(false); setError(''); setIssue(null) }
  const updateRule = (index: number, changes: Partial<Configuration['validadores'][number]>) => {
    if (configuration) edit({ ...configuration, validadores: configuration.validadores.map((rule, i) => i === index ? { ...rule, ...changes } : rule) })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!saving) onClose(); return }
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(element => element.getClientRects().length && !element.closest('fieldset:disabled'))
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const invalid = (field: string) => issue?.field === field
  const price = configuration?.precificacao
  const previewDiscount = price && Number.isFinite(price.taxa_mensal_percentual) && Number.isSafeInteger(price.base_dias) && price.base_dias > 0 && price.taxa_mensal_percentual >= 0 ? 1000 * price.taxa_mensal_percentual / 100 * 30 / price.base_dias : null
  return <dialog ref={dialog} {...backdrop} className="validators-modal operation-modal" aria-labelledby="validators-title" aria-describedby={`${id}-intro`} onKeyDown={onKeyDown} onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form noValidate onSubmit={async event => {
      event.preventDefault()
      if (!configuration || saving || !dirty) return
      const prepared = normalizedConfiguration(configuration)
      const problem = validateEditor(prepared)
      if (problem) { setIssue(problem); setTab(problem.tab); if (problem.rule) setExpanded(current => ({ ...current, [problem.rule!]: true })); return }
      setSaving(true); setError(''); setSuccess(false); setIssue(null)
      try {
        const response = await fetch(`${apiUrl}/validadores`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prepared) })
        const saved = await readResponse(response)
        setConfiguration(saved); setBaseline(JSON.stringify(saved)); setSuccess(true)
      } catch (reason) { setError(reason instanceof TypeError ? 'A conexão com a API falhou. Suas alterações continuam aqui para tentar novamente.' : reason instanceof Error ? reason.message : 'Não foi possível salvar. Suas alterações continuam no formulário para tentar novamente.') }
      finally { setSaving(false) }
    }}>
      <header className="operation-heading"><div><p className="operation-eyebrow">CONFIGURAÇÃO DA OPERAÇÃO</p><h2 id="validators-title">Regras da operação</h2><p id={`${id}-intro`}>{configuration?.fundo.nome || 'Defina os critérios para analisar sua carteira.'}</p></div><button type="button" className="operation-close" aria-label="Fechar configuração" disabled={saving} onClick={onClose}>×</button></header>
      <div className="operation-tabs" role="tablist" aria-label="Etapas da configuração">{tabs.map((item, index) => <button key={item.id} type="button" id={`${id}-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`${id}-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} disabled={loading || saving || !configuration} onClick={() => setTab(item.id)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        setTab(tabs[next].id); dialog.current?.querySelector<HTMLElement>(`[id="${id}-tab-${tabs[next].id}"]`)?.focus()
      }}><span>{String(index + 1).padStart(2, '0')}</span>{item.label}</button>)}</div>
      <div ref={body} className="operation-body" aria-busy={loading || saving}>
        {loading && <div className="operation-loading" role="status"><span className="loading-spinner" aria-hidden="true" /><strong>Buscando as regras da operação...</strong><span>Você poderá revisar os critérios antes de salvar.</span></div>}
        {!configuration && !loading && error && <div className="operation-empty-error" role="alert"><h3>Não conseguimos carregar as regras</h3><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
        {configuration && !loading && <fieldset disabled={saving} className="operation-fields"><div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
          {tab === 'fund' && <section className="operation-section"><div className="operation-section-heading"><h3>Identificação do fundo</h3><p>Confira qual operação receberá esta configuração.</p></div><div className="operation-input-grid"><label>Nome do fundo<input data-field="fund-nome" aria-invalid={invalid('fund-nome')} maxLength={200} autoComplete="off" value={configuration.fundo.nome} onChange={event => edit({ ...configuration, fundo: { ...configuration.fundo, nome: event.target.value } })} /></label><label>CNPJ do fundo<input data-field="fund-cnpj" aria-invalid={invalid('fund-cnpj')} maxLength={200} autoComplete="off" inputMode="numeric" value={configuration.fundo.cnpj} onChange={event => edit({ ...configuration, fundo: { ...configuration.fundo, cnpj: event.target.value } })} /></label></div><p className="operation-help">A configuração salva será usada nas próximas análises.</p></section>}
          {tab === 'rules' && <><div className="operation-section-heading operation-rules-summary"><div><h3>O que uma nota precisa atender?</h3><p>Ative os critérios desejados e ajuste os limites de cada regra.</p></div><span>{active} de {configuration.validadores.length} ativas</span></div>{[...new Set(configuration.validadores.map(rule => ruleInfo[rule.codigo]?.group ?? 'Outras regras'))].map(group => <section className="operation-rule-group" key={group}><h4>{group}</h4>{configuration.validadores.map((rule, index) => {
            const info = ruleInfo[rule.codigo] ?? { title: 'Critério adicional', description: 'Regra configurada para esta operação.', group: 'Outras regras' }
            if (info.group !== group) return null
            const hasParameters = Object.keys(rule.parametros).length > 0
            return <article key={rule.codigo} className={`operation-rule${rule.ativo ? ' is-enabled' : ''}`}><div className="operation-rule-heading"><div><h5>{info.title}</h5><p>{info.description}</p></div><label className="operation-switch"><input type="checkbox" role="switch" aria-label={`Ativar ${info.title}`} checked={rule.ativo} onChange={event => updateRule(index, { ativo: event.target.checked })} /><span className="operation-switch-track" aria-hidden="true" /><span>{rule.ativo ? 'Ativa' : 'Inativa'}</span></label></div><div className="operation-rule-bottom"><span>{parameterSummary(rule)}</span>{hasParameters && <button type="button" aria-expanded={Boolean(expanded[rule.codigo])} aria-controls={`${id}-${rule.codigo}-parameters`} onClick={() => setExpanded(current => ({ ...current, [rule.codigo]: !current[rule.codigo] }))}>{expanded[rule.codigo] ? 'Recolher' : 'Ajustar'} <span aria-hidden="true">{expanded[rule.codigo] ? '−' : '+'}</span></button>}</div>
              {hasParameters && expanded[rule.codigo] && <div id={`${id}-${rule.codigo}-parameters`} className="operation-parameters">{!rule.ativo && <p className="operation-help">Esta regra está inativa. Você pode preparar os parâmetros; ela só será aplicada se for ativada.</p>}<div className="operation-input-grid">{Object.entries(rule.parametros).map(([key, value]) => {
                const field = `${rule.codigo}-${key}`
                if (Array.isArray(value)) {
                  const options = [...new Set([...(key === 'tipos_aceitos' ? types : key === 'situacoes_aceitas' ? statuses : []), ...value.map(String)])]
                  return <fieldset key={key} className="operation-choice-group" data-field={field} tabIndex={-1} aria-invalid={invalid(field)}><legend>{parameterLabels[key] ?? key}</legend>{options.map(option => <label key={option}><input type="checkbox" checked={value.includes(option)} onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.checked ? [...value, option] : value.filter(item => item !== option) } })} /><span>{option}</span></label>)}</fieldset>
                }
                return <label key={key}>{parameterLabels[key] ?? key}{typeof value === 'number' ? <input data-field={field} aria-invalid={invalid(field)} type="number" min="0" max={key === 'percentual_maximo' ? 100 : undefined} step={key.endsWith('_dias') ? '1' : 'any'} value={Number.isFinite(value) ? value : ''} onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.valueAsNumber } })} /> : key === 'agrupamento' ? <select data-field={field} value={String(value)} onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.value } })}><option value="RAIZ_CNPJ">Raiz do CNPJ (8 primeiros dígitos)</option></select> : <input data-field={field} aria-invalid={invalid(field)} value={String(value ?? '')} onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.value } })} />}</label>
              })}</div></div>}
            </article>
          })}</section>)}<p className="operation-help">Os limites de concentração consideram o conjunto de notas de cada fundo, não uma nota isolada.</p></>}
          {tab === 'pricing' && <section className="operation-section"><div className="operation-section-heading"><h3>Como calcular a antecipação?</h3><p>A precificação é calculada somente para notas aprovadas.</p></div><div className="operation-method"><strong>Desconto simples</strong><span>O desconto considera o valor da nota, a taxa mensal e o prazo.</span></div><div className="operation-input-grid"><label>Taxa mensal (%)<input data-field="pricing-rate" aria-invalid={invalid('pricing-rate')} type="number" min="0" step="any" value={Number.isFinite(configuration.precificacao.taxa_mensal_percentual) ? configuration.precificacao.taxa_mensal_percentual : ''} onChange={event => edit({ ...configuration, precificacao: { ...configuration.precificacao, taxa_mensal_percentual: event.target.valueAsNumber } })} /></label><label>Base de cálculo (dias)<input data-field="pricing-days" aria-invalid={invalid('pricing-days')} type="number" min="1" step="1" value={Number.isFinite(configuration.precificacao.base_dias) ? configuration.precificacao.base_dias : ''} onChange={event => edit({ ...configuration, precificacao: { ...configuration.precificacao, base_dias: event.target.valueAsNumber } })} /><small>Quantidade de dias que corresponde à taxa mensal.</small></label></div><div className="operation-price-preview"><h4>Exemplo ilustrativo</h4><p>Nota de R$ 1.000,00 com prazo de 30 dias.</p>{previewDiscount !== null ? <dl><div><dt>Desconto</dt><dd>{money.format(previewDiscount)}</dd></div><div><dt>Valor líquido</dt><dd>{money.format(1000 - previewDiscount)}</dd></div></dl> : <p>Preencha uma taxa e uma base válidas para visualizar o exemplo.</p>}<small>Este exemplo não altera as notas analisadas nem representa uma oferta.</small></div></section>}
        </div></fieldset>}
      </div>
      <footer className="operation-actions"><div className="operation-feedback">{issue ? <p role="alert">{issue.message}</p> : error && configuration ? <p role="alert">{error}</p> : success ? <p className="operation-saved" role="status">✓ Alterações salvas. As próximas análises usarão estas regras.</p> : <p role="status">{saving ? 'Salvando a configuração...' : dirty ? 'Você tem alterações não salvas.' : 'Os resultados atuais não serão recalculados.'}</p>}</div><div className="operation-action-buttons"><button type="button" disabled={saving} onClick={onClose}>{dirty ? 'Cancelar' : 'Fechar'}</button><button type="submit" className="operation-save" disabled={loading || saving || !configuration || !dirty}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div></footer>
    </form>
  </dialog>
}
