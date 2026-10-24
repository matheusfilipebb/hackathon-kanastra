import { useEffect, useRef } from 'react'

const explanations: Record<string, string> = {
  CNPJ_SACADO_VALIDO: 'O CNPJ informado para o sacado não passou na validação cadastral.',
  SITUACAO_CADASTRAL_SACADO: 'A situação cadastral do sacado não está entre as situações aceitas pelo fundo.',
  TIPO_RECEBIVEL: 'O tipo de recebível desta nota não está habilitado na configuração atual.',
  VALOR_MINIMO: 'O valor nominal da nota está abaixo do valor mínimo configurado para análise.',
  NAO_VENCIDA: 'A data de vencimento da nota já passou.',
  PRAZO_MAXIMO: 'O prazo entre a aquisição e o vencimento ultrapassa o limite configurado.',
  PRAZO_MINIMO: 'O prazo da nota é menor que o mínimo configurado para o fundo.',
  CONCENTRACAO_MAXIMA_SACADO: 'A participação deste sacado no lote ultrapassa o percentual máximo permitido.',
  CONCENTRACAO_MAXIMA_CEDENTE: 'A participação deste cedente no lote ultrapassa o percentual máximo permitido.',
}

function formatReason(reason: string) {
  return explanations[reason] ?? reason.replace(/_/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

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
