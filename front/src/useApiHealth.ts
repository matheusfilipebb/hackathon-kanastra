import { useEffect, useState } from 'react'

const CHECK_INTERVAL_MS = 10_000
const CHECK_TIMEOUT_MS = 5_000

export function useApiHealth(apiUrl: string) {
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(false)

  useEffect(() => {
    let active = true
    let nextCheck: number | undefined
    let controller: AbortController | undefined

    const check = async () => {
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), CHECK_TIMEOUT_MS)
      try {
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health`, { signal: controller.signal, cache: 'no-store' })
        const body = response.ok ? await response.json() : null
        if (active) setOnline(response.ok && body?.status === 'ok')
      } catch {
        if (active) setOnline(false)
      } finally {
        window.clearTimeout(timeout)
        if (active) {
          setLoading(false)
          nextCheck = window.setTimeout(() => void check(), CHECK_INTERVAL_MS)
        }
      }
    }

    void check()
    return () => {
      active = false
      window.clearTimeout(nextCheck)
      controller?.abort()
    }
  }, [apiUrl])

  return { loading, online }
}
