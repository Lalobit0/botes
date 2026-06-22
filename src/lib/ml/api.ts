const ML_BASE = 'https://api.mercadolibre.com'

export interface MLSearchResult {
  numPublicaciones: number
  precioMin: number | null
  precioMax: number | null
  precioMediana: number | null
}

export async function buscarEnML(keyword: string): Promise<MLSearchResult> {
  const url = `${ML_BASE}/sites/MLM/search?q=${encodeURIComponent(keyword)}&limit=50`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ML search error: ${res.status}`)

  const json = await res.json()
  const total: number = json.paging?.total ?? 0
  const precios: number[] = (json.results ?? [])
    .map((r: { price?: number }) => r.price)
    .filter((p: unknown): p is number => typeof p === 'number' && p > 0)

  precios.sort((a, b) => a - b)

  return {
    numPublicaciones: total,
    precioMin: precios[0] ?? null,
    precioMax: precios[precios.length - 1] ?? null,
    precioMediana: calcularMediana(precios),
  }
}

export async function obtenerTendenciasML(accessToken: string): Promise<string[]> {
  const url = `${ML_BASE}/trends/MLM`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`ML trends error: ${res.status}`)
  const json = await res.json()
  return (json as Array<{ keyword: string }>).map((t) => t.keyword.toLowerCase())
}

export async function obtenerAccessToken(): Promise<string> {
  const res = await fetch(`${ML_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`ML auth error: ${res.status}`)
  const json = await res.json()
  return json.access_token
}

function calcularMediana(arr: number[]): number | null {
  if (arr.length === 0) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}
