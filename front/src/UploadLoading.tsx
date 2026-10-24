import { useEffect, useState } from 'react'
import type { UploadProgress } from './api'

const duration = (ms: number) => {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
const titles = { preparing: 'Preparando seu arquivo', uploading: 'Enviando arquivo', processing: 'Analisando as notas fiscais', receiving: 'Recebendo os resultados' }
export default function UploadLoading({ progress, startedAt, estimatedProcessingMs }: { progress: UploadProgress; startedAt: number; estimatedProcessingMs: number | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(timer) }, [])
  const stageElapsed = Math.max(0, now - progress.stageStartedAt)
  const measurable = ['uploading', 'receiving'].includes(progress.stage) && progress.total > 0
  const percentage = measurable ? Math.min(100, Math.floor(progress.loaded / progress.total * 100)) : null
  const transferRemaining = progress.loaded > 0 && stageElapsed > 500 ? stageElapsed * (progress.total - progress.loaded) / progress.loaded : null
  const analysisRemaining = estimatedProcessingMs === null ? null : estimatedProcessingMs - stageElapsed
  const remaining = measurable ? transferRemaining : progress.stage === 'processing' ? analysisRemaining : null
  return <section className="upload-progress-card" aria-labelledby="upload-progress-title">
    <div className="upload-progress-heading"><span className="loading-spinner" aria-hidden="true" /><div><p className="eyebrow">ANÁLISE DO ARQUIVO</p><h2 id="upload-progress-title">{titles[progress.stage]}</h2></div></div>
    <ol className="upload-steps" aria-label="Etapas da análise">{(['preparing', 'uploading', 'processing', 'receiving'] as const).map((stage, index) => <li key={stage} aria-current={stage === progress.stage ? 'step' : undefined}><span>{index + 1}</span>{['Preparar', 'Enviar', 'Analisar', 'Resultado'][index]}</li>)}</ol>
    <div className="upload-progress-label" role="status"><strong>{percentage !== null ? `${percentage}% ${progress.stage === 'uploading' ? 'do envio' : 'do recebimento'}` : progress.stage === 'processing' ? 'Arquivo enviado · análise em andamento' : 'Em andamento'}</strong><span>Tempo decorrido: {duration(Math.max(0, now - startedAt))}</span></div>
    <progress className="upload-progress-bar" max={100} {...(percentage !== null ? { value: percentage } : {})} aria-label={titles[progress.stage]} />
    <p className="upload-time-estimate">{remaining !== null && remaining > 0 ? `Tempo estimado para ${progress.stage === 'processing' ? 'análise' : 'esta etapa'}: cerca de ${duration(remaining)}.` : progress.stage === 'processing' && estimatedProcessingMs !== null ? 'A análise está levando mais tempo que a anterior. Aguarde o resultado.' : 'Estimando o tempo desta etapa...'}</p>
    <p className="upload-progress-note">{progress.stage === 'processing' ? 'O envio terminou. A API está verificando as notas e ainda não informa uma porcentagem da análise.' : 'A porcentagem acompanha a transferência do arquivo. O tempo estimado pode variar conforme a conexão e o tamanho do lote.'}</p>
  </section>
}
