// HTTP errors mean the server answered; only transport failures mark it offline.
export async function requestApi(url: string, init: RequestInit | undefined, onConnection: (online: boolean) => void): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    if (!init?.signal?.aborted) onConnection(false)
    throw new Error('Não foi possível conectar à API. Confira sua conexão e tente novamente.')
  }
  if (!init?.signal?.aborted) onConnection(![502, 503, 504].includes(response.status))
  return response
}

export type UploadStage = 'preparing' | 'uploading' | 'processing' | 'receiving'
export type UploadProgress = { stage: UploadStage; loaded: number; total: number; stageStartedAt: number }

export function uploadCsv(url: string, file: File, onProgress: (progress: UploadProgress) => void, onConnection: (online: boolean) => void): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    let stageStartedAt = Date.now()
    let currentStage: UploadStage = 'uploading'
    const report = (stage: UploadStage, loaded = 0, total = 0) => {
      if (currentStage !== stage) { currentStage = stage; stageStartedAt = Date.now() }
      onProgress({ stage, loaded, total, stageStartedAt })
    }
    request.open('POST', url)
    request.responseType = 'blob'
    request.upload.onprogress = event => report('uploading', event.loaded, event.lengthComputable ? event.total : 0)
    request.upload.onload = () => report('processing')
    request.onprogress = event => report('receiving', event.loaded, event.lengthComputable ? event.total : 0)
    request.onload = () => {
      onConnection(![502, 503, 504].includes(request.status))
      resolve(new Response(request.response, { status: request.status, headers: { 'Content-Type': request.getResponseHeader('Content-Type') ?? 'application/json' } }))
    }
    request.onerror = () => { onConnection(false); reject(new Error('A conexão com a API foi interrompida durante o envio. Tente novamente.')) }
    request.onabort = () => reject(new Error('Envio cancelado.'))
    const form = new FormData()
    form.append('file', file)
    report('uploading')
    request.send(form)
  })
}
