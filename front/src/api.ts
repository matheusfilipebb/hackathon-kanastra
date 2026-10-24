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
