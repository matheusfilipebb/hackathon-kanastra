import { useEffect, useRef } from 'react'
import { uniqueReasons } from './reasons'
import RejectionReasons from './RejectionReasons'
import { useModalBackdrop } from './useModalBackdrop'

export type InvoiceDetails = {
  id: string; fundo: string; fundoDocumento: string; cedente: string; cedenteDocumento?: string
  sacado: string; cnpj: string; valor: number; tipo: string; vencimento: string; aquisicao?: string
  linha?: number; situacaoCadastral?: string; aprovado: boolean; motivos: string[]
  precificacao?: { prazo_dias: number; valor_nominal: number; valor_desconto: number; valor_liquido: number }
}
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function date(value?: string) {
  if (!value) return 'Não informada'
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value
}

export default function InvoiceModal({ invoice, onClose }: { invoice: InvoiceDetails; onClose: () => void }) {
  const reasons = uniqueReasons(invoice.motivos)
  const dialog = useRef<HTMLDialogElement>(null)
  const backdropHandlers = useModalBackdrop(onClose)
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const element = dialog.current
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  return <dialog ref={dialog} {...backdropHandlers} className="invoice-modal" aria-labelledby="invoice-modal-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="invoice-modal-content">
    <div className="invoice-modal-heading"><div><p className="eyebrow">DETALHES DA NOTA</p><h2 id="invoice-modal-title">{invoice.id}</h2></div><button type="button" className="modal-close" aria-label="Fechar detalhes da nota" onClick={onClose}>×</button></div>
    <span className={`status ${invoice.aprovado ? 'approved' : 'rejected'}`}><span />{invoice.aprovado ? 'Aprovada' : 'Não aprovada'}</span>
    {!invoice.aprovado && <section className="rejection-summary" aria-labelledby="rejection-title"><p className="eyebrow">ENTENDA O RESULTADO</p><h3 id="rejection-title">Por que esta nota não foi aprovada?</h3><p>{reasons.length ? `${reasons.length === 1 ? 'Encontramos 1 critério não atendido' : `Encontramos ${reasons.length} critérios não atendidos`} nesta análise. Veja a explicação e o que conferir em cada caso.` : 'Veja abaixo como conferir o resultado desta nota.'}</p><RejectionReasons reasons={reasons} /><p className="rejection-followup">Se houver dados incorretos, corrija o arquivo e envie uma nova análise. O resultado depende dos dados e das regras aplicadas naquele envio.</p></section>}
    <section><h3>Dados do recebível</h3><dl className="invoice-details-grid">
      <div><dt>Tipo</dt><dd>{invoice.tipo || 'Não informado'}</dd></div><div><dt>Valor nominal</dt><dd>{currency.format(invoice.valor)}</dd></div>
      <div><dt>Data de aquisição</dt><dd>{date(invoice.aquisicao)}</dd></div><div><dt>Vencimento original</dt><dd>{date(invoice.vencimento)}</dd></div>
      <div><dt>Linha no arquivo</dt><dd>{invoice.linha ?? 'Não informada'}</dd></div>
    </dl></section>
    <section><h3>Fundo e empresas</h3><dl className="invoice-details-grid">
      <div><dt>Fundo</dt><dd>{invoice.fundo}</dd></div><div><dt>CNPJ do fundo</dt><dd>{invoice.fundoDocumento || 'Não informado'}</dd></div>
      <div><dt>Cedente</dt><dd>{invoice.cedente}</dd></div><div><dt>Documento do cedente</dt><dd>{invoice.cedenteDocumento || 'Não informado'}</dd></div>
      <div><dt>Sacado</dt><dd>{invoice.sacado}</dd></div><div><dt>Documento do sacado</dt><dd>{invoice.cnpj || 'Não informado'}</dd></div>
      <div><dt>Situação cadastral informada no arquivo</dt><dd>{invoice.situacaoCadastral || 'Não informada'}</dd></div>
    </dl></section>
    {invoice.aprovado && <section><h3>Resultado da análise</h3><p>Todos os critérios ativos foram atendidos.</p></section>}
    <section><h3>Simulação do recebível</h3>{invoice.precificacao ? <dl className="invoice-details-grid">
      <div><dt>Valor nominal da simulação</dt><dd>{currency.format(invoice.precificacao.valor_nominal)}</dd></div><div><dt>Prazo considerado</dt><dd>{invoice.precificacao.prazo_dias} dias</dd></div>
      <div><dt>Desconto</dt><dd>{currency.format(invoice.precificacao.valor_desconto)}</dd></div><div><dt>Valor líquido</dt><dd className="invoice-net-value">{currency.format(invoice.precificacao.valor_liquido)}</dd></div>
    </dl> : <p>{invoice.aprovado ? 'A precificação não foi informada.' : 'O valor líquido é calculado apenas para notas aprovadas. Por isso, esta nota não tem uma simulação.'}</p>}</section>
    <div className="validators-actions"><button type="button" onClick={onClose}>Fechar</button></div>
    </div>
  </dialog>
}
