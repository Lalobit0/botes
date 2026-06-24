const ML_BASE = 'https://api.mercadolibre.com'

export interface MLSearchResult {
  numPublicaciones: number
  precioMin: number | null
  precioMax: number | null
  precioMediana: number | null
}

// ML cerró su API de búsqueda: GET /sites/MLM/search devuelve 403 "forbidden"
// incluso con un token de app (client_credentials). Como alternativa leemos el
// sitio público de listados (listado.mercadolibre.com.mx), que no requiere auth,
// y extraemos el número de publicaciones y los precios visibles.
export async function buscarEnML(keyword: string): Promise<MLSearchResult> {
  const slug = keyword.trim().toLowerCase().replace(/\s+/g, '-')
  const url = `https://listado.mercadolibre.com.mx/${encodeURIComponent(slug).replace(/%2D/g, '-')}`
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'es-MX,es;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  const html = await res.text()

  // Número de publicaciones: "1.234 resultados" (MX usa . como separador de miles)
  let numPublicaciones = 0
  const qty = html.match(/([\d.,]+)\s*resultados/i)
  if (qty) numPublicaciones = parseInt(qty[1].replace(/[.,]/g, ''), 10) || 0

  // Precios visibles: spans andes-money-amount__fraction (parte entera del precio)
  const precios: number[] = []
  const re = /andes-money-amount__fraction[^>]*>\s*([\d.,]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const n = parseInt(m[1].replace(/[.,]/g, ''), 10)
    if (n > 0) precios.push(n)
  }
  precios.sort((a, b) => a - b)

  // Diagnóstico: qué nos devolvió realmente ML al server de Vercel
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
  console.log(
    `[buscarEnML] "${keyword}" url=${url} status=${res.status} len=${html.length} ` +
    `pub=${numPublicaciones} precios=${precios.length} ` +
    `has_resultados=${/resultados/i.test(html)} has_money=${/andes-money-amount/.test(html)} ` +
    `captcha=${/captcha|robot|verifica que eres|challenge/i.test(html)} ` +
    `title="${titleMatch?.[1]?.slice(0, 80) ?? ''}"`
  )

  return {
    numPublicaciones,
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
