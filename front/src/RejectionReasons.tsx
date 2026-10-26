import { getReasonDetails, uniqueReasons } from './reasons'

export default function RejectionReasons({ reasons }: { reasons: string[] }) {
  const items = uniqueReasons(reasons)
  if (!items.length) return <div className="rejection-empty"><strong>O motivo não foi informado</strong><p>A nota não foi aprovada, mas a análise não retornou uma explicação. Peça à equipe responsável para conferir o resultado.</p></div>

  return <ol className="rejection-reasons">{items.map((reason, index) => {
    const detail = getReasonDetails(reason)
    return <li key={reason}>
      <span className="rejection-number" aria-hidden="true">{index + 1}</span>
      <div><h4>{detail.title}</h4><p>{detail.description}</p><div className="rejection-guidance"><strong>O que conferir</strong><p>{detail.action}</p></div></div>
    </li>
  })}</ol>
}
