import { useEffect, useRef } from 'react'

import RejectionReasons from './RejectionReasons'

export default function ReasonModal({ invoiceId, reasons, onClose }: { invoiceId: string; reasons: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const currentDialog = dialog.current
    currentDialog?.showModal()
    return () => { if (currentDialog?.open) currentDialog.close() }
  }, [])

  return <dialog ref={dialog} className="reason-modal" aria-labelledby="reason-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="reason-modal-heading"><div><p className="eyebrow">ENTENDA O RESULTADO</p><h2 id="reason-title">Por que a nota não foi aprovada?</h2></div><button type="button" className="modal-close" aria-label="Fechar explicação" onClick={onClose}>×</button></div>
    <p className="reason-invoice">Nota fiscal <strong>{invoiceId}</strong> não atende a todos os critérios do fundo.</p>
    <RejectionReasons reasons={reasons} />
    <button type="button" className="reason-close" onClick={onClose}>Entendi</button>
  </dialog>
}
