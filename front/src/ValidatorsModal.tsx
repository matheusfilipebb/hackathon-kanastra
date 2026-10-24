import { useModalBackdrop } from './useModalBackdrop'
import { useEffect, useRef, useState } from 'react'

type Configuration = {
  fundo: { nome: string; cnpj: string }
  validadores: { codigo: string; ativo: boolean; parametros: Record<string, unknown> }[]
  precificacao: { metodo: string; taxa_mensal_percentual: number; base_dias: number }
}

const labels: Record<string, string> = {
  CNPJ_SACADO_VALIDO: 'CNPJ do sacado válido', SITUACAO_CADASTRAL_SACADO: 'Situação cadastral do sacado',
  TIPO_RECEBIVEL: 'Tipos de recebível', VALOR_MINIMO: 'Valor mínimo', NAO_VENCIDA: 'Nota não vencida',
  PRAZO_MAXIMO: 'Prazo máximo', PRAZO_MINIMO: 'Prazo mínimo',
  CONCENTRACAO_MAXIMA_SACADO: 'Concentração máxima do sacado', CONCENTRACAO_MAXIMA_CEDENTE: 'Concentração máxima do cedente',
  valor_minimo: 'Valor mínimo (R$)', percentual_maximo: 'Percentual máximo (%)',
  prazo_minimo_dias: 'Prazo mínimo (dias)', prazo_maximo_dias: 'Prazo máximo (dias)',
  agrupamento: 'Agrupamento', tipos_aceitos: 'Tipos aceitos (separados por vírgula)', situacoes_aceitas: 'Situações aceitas (separadas por vírgula)',
}

async function readResponse(response: Response): Promise<Configuration> {
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message ?? `A API respondeu com status ${response.status}.`)
  if (!body?.fundo || !Array.isArray(body.validadores) || !body.precificacao) throw new Error('A API retornou uma configuração inválida.')
  return body
}

export default function ValidatorsModal({ apiUrl, onClose }: { apiUrl: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [configuration, setConfiguration] = useState<Configuration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const backdropHandlers = useModalBackdrop(onClose, saving)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const previousFocus = document.activeElement
    dialog.current?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch(`${apiUrl}/validadores`, { signal: controller.signal })
      .then(readResponse).then(setConfiguration)
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os validadores.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [apiUrl, attempt])

  const updateRule = (index: number, changes: Partial<Configuration['validadores'][number]>) => {
    setSuccess(false)
    setConfiguration(current => current && ({ ...current, validadores: current.validadores.map((rule, i) => i === index ? { ...rule, ...changes } : rule) }))
  }

  return <dialog ref={dialog} {...backdropHandlers} className="validators-modal" aria-labelledby="validators-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form onChange={() => setSuccess(false)} onSubmit={async event => {
      event.preventDefault()
      if (!configuration || saving) return
      setSaving(true); setError(''); setSuccess(false)
      try {
        const response = await fetch(`${apiUrl}/validadores`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configuration) })
        setConfiguration(await readResponse(response)); setSuccess(true)
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar os validadores.') }
      finally { setSaving(false) }
    }}>
      <div className="validators-heading"><div><p className="eyebrow">CONFIGURAÇÃO</p><h2 id="validators-title">Validadores do fundo</h2></div><button type="button" className="modal-close" aria-label="Fechar configuração" disabled={saving} onClick={onClose}>×</button></div>
      <p>Altere as regras usadas nas próximas análises. Os resultados já exibidos não serão recalculados.</p>
      {loading && <p role="status">Carregando configuração...</p>}
      {error && <div className="error-message" role="alert">{error}{!configuration && !loading && <button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}</div>}
      {success && <p className="validators-success" role="status">Configuração salva com sucesso.</p>}
      {configuration && <fieldset disabled={saving} className="validators-fields">
        <div className="validators-grid">
          <label>Nome do fundo<input required value={configuration.fundo.nome} onChange={event => setConfiguration({ ...configuration, fundo: { ...configuration.fundo, nome: event.target.value } })} /></label>
          <label>CNPJ do fundo<input required value={configuration.fundo.cnpj} onChange={event => setConfiguration({ ...configuration, fundo: { ...configuration.fundo, cnpj: event.target.value } })} /></label>
        </div>
        {configuration.validadores.map((rule, index) => <section className="validator-editor" key={rule.codigo}>
          <label className="validator-toggle"><input type="checkbox" checked={rule.ativo} onChange={event => updateRule(index, { ativo: event.target.checked })} /><span><strong>{labels[rule.codigo] ?? rule.codigo}</strong><small>{rule.codigo}</small></span><span>{rule.ativo ? 'Ativo' : 'Inativo'}</span></label>
          <div className="validators-grid">{Object.entries(rule.parametros).map(([key, value]) => <label key={key}>{labels[key] ?? key}
            {typeof value === 'number' ? <input required type="number" min="0" step={key.endsWith('_dias') ? '1' : 'any'} defaultValue={value} onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.valueAsNumber } })} />
              : Array.isArray(value) ? <input defaultValue={value.join(', ')} required onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.value.split(',').map(item => item.trim()).filter(Boolean) } })} />
              : <input required value={String(value ?? '')} onChange={event => updateRule(index, { parametros: { ...rule.parametros, [key]: event.target.value } })} />}
          </label>)}</div>
        </section>)}
        <h3>Precificação</h3><div className="validators-grid">
          <label>Método<select value={configuration.precificacao.metodo} onChange={event => setConfiguration({ ...configuration, precificacao: { ...configuration.precificacao, metodo: event.target.value } })}><option value="DESCONTO_SIMPLES">Desconto simples</option></select></label>
          <label>Taxa mensal (%)<input required type="number" min="0" step="any" defaultValue={configuration.precificacao.taxa_mensal_percentual} onChange={event => setConfiguration({ ...configuration, precificacao: { ...configuration.precificacao, taxa_mensal_percentual: event.target.valueAsNumber } })} /></label>
          <label>Base (dias)<input required type="number" min="1" step="1" defaultValue={configuration.precificacao.base_dias} onChange={event => setConfiguration({ ...configuration, precificacao: { ...configuration.precificacao, base_dias: event.target.valueAsNumber } })} /></label>
        </div>
      </fieldset>}
      <div className="validators-actions"><button type="button" disabled={saving} onClick={onClose}>Fechar</button><button className="validators-save" type="submit" disabled={loading || saving || !configuration}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
    </form>
  </dialog>
}
