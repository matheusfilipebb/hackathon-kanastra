import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useModalBackdrop } from './useModalBackdrop'
import './FundPicker.css'

type FundOption = [string, string]
type Props = { options: FundOption[]; value: string; onChange: (value: string) => void; label?: string; disabled?: boolean }
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

function FundDialog({ id, options, value, onChange, onClose }: Props & { id: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const backdrop = useModalBackdrop(onClose)
  const matches = useMemo(() => {
    const text = searchable(query.trim())
    const document = /^[\d.\-/\s]+$/.test(query.trim()) ? query.replace(/\D/g, '') : ''
    return options.filter(([, label]) => searchable(label).includes(text) || Boolean(document && label.replace(/\D/g, '').includes(document)))
  }, [options, query])
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    search.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  const choose = (key: string) => { onChange(key); onClose() }
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <dialog ref={dialog} id={id} className="fund-picker-modal" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`} {...backdrop} onKeyDown={onKeyDown} onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="fund-picker-heading"><div><h2 id={`${id}-title`}>Selecionar fundo</h2><p id={`${id}-hint`}>Escolha um fundo para filtrar a análise.</p></div><button type="button" className="fund-picker-close" aria-label="Fechar seleção de fundo" onClick={onClose}>×</button></header>
    <label className="fund-picker-search">Buscar fundo<input ref={search} type="search" placeholder="Nome ou CNPJ do fundo" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <button type="button" className="fund-picker-option fund-picker-all" aria-pressed={!value} onClick={() => choose('')}><span>Todos os fundos<small>Exibir o arquivo completo</small></span><span className="fund-picker-check" aria-hidden="true">{!value ? '✓' : ''}</span></button>
    <p className="fund-picker-count" role="status">{matches.length.toLocaleString('pt-BR')} {matches.length === 1 ? 'fundo encontrado' : 'fundos encontrados'}</p>
    <div className="fund-picker-options" role="group" aria-label="Fundos disponíveis">{matches.length ? matches.map(([key, label]) => <button key={key} type="button" className="fund-picker-option" aria-pressed={value === key} onClick={() => choose(key)}><span>{label}</span><span className="fund-picker-check" aria-hidden="true">{value === key ? '✓' : ''}</span></button>) : <p className="fund-picker-empty">Nenhum fundo encontrado. Tente outro nome ou CNPJ.</p>}</div>
    <footer className="fund-picker-footer"><span>A seleção é aplicada ao escolher um fundo.</span><button type="button" onClick={onClose}>Cancelar</button></footer>
  </dialog>
}

export default function FundPicker({ options, value, onChange, label = 'Filtrar por fundo', disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const selectedLabel = options.find(([key]) => key === value)?.[1] ?? 'Todos os fundos'
  return <div className="fund-picker"><span className="fund-picker-label" id={`${id}-label`}>{label}</span><button type="button" className="fund-picker-trigger" aria-label={`${label}: ${selectedLabel}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} disabled={disabled} onClick={() => setOpen(true)}><span title={selectedLabel}>{selectedLabel}</span><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button>{open && createPortal(<FundDialog id={`${id}-dialog`} options={options} value={value} onChange={onChange} onClose={() => setOpen(false)} />, document.body)}</div>
}
