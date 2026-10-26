import { transferBytesPerSecond } from './uploadEstimates'
import type { TransferPoint } from './uploadEstimates'

export async function requestApi(url: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new Error('Não foi possível conectar à API. Confira sua conexão e tente novamente.')
  }
  return response
}

export type UploadStage = 'preparing' | 'uploading' | 'processing' | 'receiving'
export type UploadProgress = { stage: UploadStage; loaded: number; total: number; stageStartedAt: number; updatedAt?: number; bytesPerSecond?: number }

export function uploadCsv(url: string, file: File, onProgress: (progress: UploadProgress) => void): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    let stageStartedAt = Date.now()
    let currentStage: UploadStage = 'uploading'
    let points: TransferPoint[] = [{ loaded: 0, at: stageStartedAt }]
    const report = (stage: UploadStage, loaded = 0, total = 0) => {
      const now = Date.now()
      if (currentStage !== stage) { currentStage = stage; stageStartedAt = now; points = [{ loaded: 0, at: now }] }
      points.push({ loaded, at: now })
      points = points.slice(-20)
      onProgress({ stage, loaded, total, stageStartedAt, updatedAt: now, bytesPerSecond: transferBytesPerSecond(points) })
    }
    request.open('POST', url)
    request.responseType = 'blob'
    request.upload.onprogress = event => { if (currentStage === 'uploading') report('uploading', event.loaded, event.lengthComputable ? event.total : 0) }
    request.upload.onload = () => { if (currentStage === 'uploading') report('processing') }
    request.onreadystatechange = () => { if (request.readyState === XMLHttpRequest.HEADERS_RECEIVED) report('receiving') }
    request.onprogress = event => report('receiving', event.loaded, event.lengthComputable ? event.total : 0)
    request.onload = () => {
      resolve(new Response(request.response, { status: request.status, headers: { 'Content-Type': request.getResponseHeader('Content-Type') ?? 'application/json' } }))
    }
    request.onerror = () => reject(new Error('A conexão com a API foi interrompida durante o envio. Tente novamente.'))
    request.onabort = () => reject(new Error('Envio cancelado.'))
    const form = new FormData()
    form.append('file', file)
    report('uploading')
    request.send(form)
  })
}
