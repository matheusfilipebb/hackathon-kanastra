export type AnalysisSample = { rows: number; ms: number; at: number }
export type DurationEstimate = { lowerMs: number; upperMs: number; samples: number }
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>
const WEEK = 7 * 24 * 60 * 60 * 1000
const key = (apiUrl: string) => `antecipe:analysis-times:v1:${apiUrl}`
function validSample(value: unknown, now: number): value is AnalysisSample {
  if (!value || typeof value !== 'object') return false
  const sample = value as AnalysisSample
  return Number.isSafeInteger(sample.rows) && sample.rows > 0 && Number.isFinite(sample.ms) && sample.ms >= 20 && sample.ms <= 3600000 && Number.isFinite(sample.at) && sample.at >= now - WEEK && sample.at <= now + 60000
}
export function cleanHistory(values: unknown[], now = Date.now()): AnalysisSample[] {
  return values.filter(value => validSample(value, now)).sort((a, b) => a.at - b.at).slice(-10)
}
export function readAnalysisHistory(apiUrl: string, storage?: HistoryStorage, now = Date.now()): AnalysisSample[] {
  try {
    const data = JSON.parse((storage ?? globalThis.localStorage).getItem(key(apiUrl)) ?? '[]')
    return Array.isArray(data) ? cleanHistory(data, now) : []
  } catch { return [] }
}
export function saveAnalysisHistory(apiUrl: string, history: AnalysisSample[], storage?: HistoryStorage) {
  try { (storage ?? globalThis.localStorage).setItem(key(apiUrl), JSON.stringify(cleanHistory(history))) } catch { /* Estimates still work in memory when storage is unavailable. */ }
}
const quantile = (sorted: number[], fraction: number) => {
  const index = (sorted.length - 1) * fraction
  const lower = Math.floor(index)
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
}
export function estimateAnalysis(rows: number, history: AnalysisSample[], now = Date.now()): DurationEstimate | null {
  if (!Number.isSafeInteger(rows) || rows <= 0) return null
  const comparable = cleanHistory(history, now).filter(sample => rows / sample.rows >= .25 && rows / sample.rows <= 4)
    .sort((a, b) => Math.abs(Math.log(rows / a.rows)) - Math.abs(Math.log(rows / b.rows)) || b.at - a.at).slice(0, 5)
  if (!comparable.length) return null
  const predicted = comparable.map(sample => sample.ms * rows / sample.rows).sort((a, b) => a - b)
  const median = quantile(predicted, .5)
  const typical = predicted.length >= 3 ? predicted.filter(value => value >= median / 4 && value <= median * 4) : predicted
  const lowerMs = Math.max(0, quantile(typical, .2) * .7 - 250)
  const upperMs = Math.max(lowerMs + 1000, quantile(typical, .8) * 1.4 + 250)
  return { lowerMs, upperMs, samples: typical.length }
}
export type TransferPoint = { loaded: number; at: number }
export function transferBytesPerSecond(points: TransferPoint[]): number | undefined {
  if (points.length < 2) return undefined
  const last = points[points.length - 1]
  const first = points.find(point => point.at >= last.at - 5000 && point.at < last.at) ?? points[points.length - 2]
  const elapsed = last.at - first.at
  const delta = last.loaded - first.loaded
  return elapsed >= 200 && delta > 0 ? delta / elapsed * 1000 : undefined
}
