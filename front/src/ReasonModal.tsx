import { useEffect, useRef } from 'react'

import { formatReason } from './reasons'

export default function ReasonModal({ invoiceId, reasons, onClose }: { invoiceId: string; reasons: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const currentDialog = dialog.current
    currentDialog?.showModal()
    return () => { if (currentDialog?.open) currentDialog.close() }
  }, [])

  return <dialog ref={dialog} className="reason-modal" aria-labelledby="reason-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="reason-modal-heading"><div><p className="eyebrow">ANÁLISE DA API</p><h2 id="reason-title">Por que a nota foi reprovada?</h2></div><button type="button" className="modal-close" aria-label="Fechar explicação" onClick={onClose}>×</button></div>
    <p className="reason-invoice">Nota fiscal <strong>{invoiceId}</strong> não atende a todos os critérios do fundo.</p>
    <div className="reason-list">{reasons.map((reason) => <div className="reason-detail" key={reason}><span className="reason-code">i</span><div><strong>{reason.replace(/_/g, ' ')}</strong><p>{formatReason(reason)}</p></div></div>)}</div>
    <button type="button" className="reason-close" onClick={onClose}>Entendi</button>
  </dialog>
}
