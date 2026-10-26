import { useEffect, useState } from 'react'
import type { UploadProgress } from './api'
import type { DurationEstimate } from './uploadEstimates'

const duration = (ms: number) => {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
const titles = { preparing: 'Preparando seu arquivo', uploading: 'Enviando arquivo', processing: 'Analisando as notas fiscais', receiving: 'Recebendo os resultados' }
export default function UploadLoading({ progress, startedAt, estimatedProcessing }: { progress: UploadProgress; startedAt: number; estimatedProcessing: DurationEstimate | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(timer) }, [])
  const stageElapsed = Math.max(0, now - progress.stageStartedAt)
  const measurable = ['uploading', 'receiving'].includes(progress.stage) && progress.total > 0
  const percentage = measurable ? Math.min(100, Math.floor(progress.loaded / progress.total * 100)) : null
  const stalled = now - (progress.updatedAt ?? progress.stageStartedAt) > 8000
  const transferRemaining = measurable && progress.bytesPerSecond && !stalled ? (progress.total - progress.loaded) / progress.bytesPerSecond * 1000 : null
  let estimateText = 'Estimando o tempo desta etapa...'
  if (progress.stage === 'processing') {
    if (!estimatedProcessing) estimateText = 'Análise em andamento. Ainda não há medições de lotes semelhantes para estimar o tempo.'
    else {
      const lower = Math.max(0, estimatedProcessing.lowerMs - stageElapsed)
      const upper = estimatedProcessing.upperMs - stageElapsed
      estimateText = upper <= 0 ? 'A análise ultrapassou a faixa prevista e continua em andamento.' : lower < 1000 ? `Tempo restante estimado da análise: até ${duration(upper)}.` : `Tempo restante estimado da análise: entre ${duration(lower)} e ${duration(upper)}.`
    }
  } else if (measurable && percentage === 100) estimateText = 'Transferência concluída. Finalizando esta etapa...'
  else if (transferRemaining !== null) estimateText = `Tempo estimado para esta transferência: cerca de ${duration(transferRemaining)}.`
  else if (stalled && measurable) estimateText = 'Aguardando novos dados da transferência para atualizar a estimativa.'
  return <section className="upload-progress-card" aria-labelledby="upload-progress-title">
    <div className="upload-progress-heading"><span className="loading-spinner" aria-hidden="true" /><div><p className="eyebrow">ANÁLISE DO ARQUIVO</p><h2 id="upload-progress-title">{titles[progress.stage]}</h2></div></div>
    <ol className="upload-steps" aria-label="Etapas da análise">{(['preparing', 'uploading', 'processing', 'receiving'] as const).map((stage, index) => <li key={stage} aria-current={stage === progress.stage ? 'step' : undefined}><span>{index + 1}</span>{['Preparar', 'Enviar', 'Analisar', 'Resultado'][index]}</li>)}</ol>
    <div className="upload-progress-label" role="status"><strong>{percentage !== null ? `${percentage}% ${progress.stage === 'uploading' ? 'do envio' : 'do recebimento'}` : progress.stage === 'processing' ? 'Arquivo enviado · análise em andamento' : 'Em andamento'}</strong><span>Tempo decorrido: {duration(Math.max(0, now - startedAt))}</span></div>
    <progress className="upload-progress-bar" max={100} {...(percentage !== null ? { value: percentage } : {})} aria-label={titles[progress.stage]} />
    <p className="upload-time-estimate">{estimateText}</p>
    <p className="upload-progress-note">{progress.stage === 'processing' ? estimatedProcessing ? `Faixa baseada em ${estimatedProcessing.samples} ${estimatedProcessing.samples === 1 ? 'análise recente' : 'análises recentes'} com quantidade semelhante de notas nesta API. O processamento não informa uma porcentagem de conclusão.` : 'As medições desta análise ajudarão a estimar os próximos lotes. O processamento não informa uma porcentagem de conclusão.' : 'A porcentagem acompanha a transferência. O tempo usa a velocidade recente da conexão e pode variar.'}</p>
  </section>
}
