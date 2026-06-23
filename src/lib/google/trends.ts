// Integración NO oficial de Google Trends (uso personal).
// Usa los endpoints internos de trends.google.com. Puede ser limitado
// por rate-limit desde IPs de servidores; si falla, devolvemos null y
// el refresco continúa sin romperse.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

interface Widget {
  id: string
  token: string
  request: unknown
}

function stripPrefix(text: string): string {
  // Las respuestas empiezan con )]}'\n antes del JSON
  const idx = text.indexOf('{')
  return idx >= 0 ? text.slice(idx) : text
}

async function getTimeseriesWidget(
  keyword: string,
  geo: string,
  time: string
): Promise<Widget | null> {
  const req = {
    comparisonItem: [{ keyword, geo, time }],
    category: 0,
    property: '',
  }
  const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-360&req=${encodeURIComponent(
    JSON.stringify(req)
  )}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  })
  if (!res.ok) throw new Error(`explore ${res.status}`)
  const json = JSON.parse(stripPrefix(await res.text())) as { widgets: Widget[] }
  return json.widgets.find((w) => w.id === 'TIMESERIES') ?? null
}

async function getTimeline(widget: Widget): Promise<number[]> {
  const url = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-360&req=${encodeURIComponent(
    JSON.stringify(widget.request)
  )}&token=${widget.token}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`multiline ${res.status}`)
  const json = JSON.parse(stripPrefix(await res.text())) as {
    default: { timelineData: Array<{ value: number[] }> }
  }
  return (json.default?.timelineData ?? []).map((d) => d.value?.[0] ?? 0)
}

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export interface GoogleTrendsResult {
  score: number // 0-100 (momentum derivado del crecimiento)
  firstAvg: number
  lastAvg: number
  growthPct: number
}

/**
 * Devuelve el momentum (0-100) de un keyword según la pendiente de búsqueda
 * en Google Trends. 50 = plano, >50 = creciendo, <50 = cayendo.
 */
export async function getGoogleTrendsMomentum(
  keyword: string,
  geo = 'US',
  time = 'today 3-m'
): Promise<GoogleTrendsResult | null> {
  try {
    const widget = await getTimeseriesWidget(keyword, geo, time)
    if (!widget) return null
    const vals = await getTimeline(widget)
    if (vals.length < 4) return null

    const third = Math.max(1, Math.floor(vals.length / 3))
    const firstAvg = avg(vals.slice(0, third))
    const lastAvg = avg(vals.slice(-third))
    const base = Math.max(firstAvg, 1)
    const growthPct = ((lastAvg - firstAvg) / base) * 100
    const score = clamp(50 + growthPct / 2, 0, 100)

    return { score, firstAvg, lastAvg, growthPct }
  } catch {
    return null
  }
}
