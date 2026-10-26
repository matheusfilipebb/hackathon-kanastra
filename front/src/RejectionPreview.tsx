import { getReasonTitle, uniqueReasons } from './reasons'

export default function RejectionPreview({ invoiceId, reasons, onOpen }: { invoiceId: string; reasons: string[]; onOpen: () => void }) {
  const items = uniqueReasons(reasons)
  return <button type="button" className="rejection-preview" aria-label={`Ver motivos da nota ${invoiceId}`} onClick={event => { event.stopPropagation(); onOpen() }}>
    <strong>{items.length ? getReasonTitle(items[0]) : 'Motivo não informado'}</strong>
    {items.length > 1 && <span className="rejection-more">+ {items.length - 1} {items.length === 2 ? 'outro motivo' : 'outros motivos'}</span>}
    <span className="rejection-open">Ver motivos <span aria-hidden="true">↗</span></span>
  </button>
}
