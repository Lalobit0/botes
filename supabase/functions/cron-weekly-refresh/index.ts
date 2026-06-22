import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Invocado cada lunes a las 6am (configurar en Dashboard de Supabase):
// cron: "0 6 * * 1"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID')
const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function obtenerMLToken(): Promise<string | null> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return null
  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
      }),
    })
    const json = await res.json()
    return json.access_token ?? null
  } catch { return null }
}

async function obtenerTendenciasML(token: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.mercadolibre.com/trends/MLM', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json: Array<{ keyword: string }> = await res.json()
    return json.map((t) => t.keyword.toLowerCase())
  } catch { return [] }
}

async function buscarEnML(keyword: string) {
  const url = `https://api.mercadolibre.com/sites/MLM/search?q=${encodeURIComponent(keyword)}&limit=50`
  const res = await fetch(url)
  const json = await res.json()
  const total: number = json.paging?.total ?? 0
  const precios: number[] = (json.results ?? [])
    .map((r: { price?: number }) => r.price)
    .filter((p: unknown): p is number => typeof p === 'number' && p > 0)
    .sort((a: number, b: number) => a - b)

  const mid = Math.floor(precios.length / 2)
  const mediana = precios.length === 0 ? null
    : precios.length % 2 !== 0 ? precios[mid]
    : (precios[mid - 1] + precios[mid]) / 2

  return {
    numPublicaciones: total,
    precioMin: precios[0] ?? null,
    precioMax: precios[precios.length - 1] ?? null,
    precioMediana: mediana,
  }
}

function calcularOportunidad(
  signals: Array<{ fuente: string; tier?: string | null; rank?: number | null; valor?: number | null }>,
  sat: { num_publicaciones: number | null; aparece_en_ml_trends: boolean } | null,
  margin: { precio_origen_usd: number | null; tipo_cambio: number; costo_envio_importacion_mxn: number; arancel_pct: number; iva_pct: number; precio_venta_estimado_mxn: number | null } | null
) {
  const pesos = { tiktok: 0.4, aliexpress: 0.3, amazon_us: 0.2, google_trends: 0.1 }
  const tierScores: Record<string, number> = { emergente: 100, creciente: 70, establecida: 40 }

  let sumaScore = 0, sumaPesos = 0
  for (const [fuente, peso] of Object.entries(pesos)) {
    const rel = signals.filter((s) => s.fuente === fuente)
    if (rel.length === 0) continue
    let s = 0
    if (fuente === 'tiktok') s = tierScores[rel[0].tier ?? ''] ?? 0
    else if (fuente === 'aliexpress') s = Math.min(100, ((rel[0].valor ?? 0) / 500) * 100)
    else if (fuente === 'amazon_us') s = rel[0].rank != null ? Math.max(0, 100 - rel[0].rank + 1) : Math.min(100, rel[0].valor ?? 0)
    else if (fuente === 'google_trends') s = Math.min(100, Math.max(0, rel[0].valor ?? 0))
    sumaScore += s * peso; sumaPesos += peso
  }
  const momentumScore = sumaPesos > 0 ? sumaScore / sumaPesos : 0

  const satScore = sat
    ? Math.min(100, Math.min(100, 20 * Math.log10((sat.num_publicaciones ?? 0) + 1)) + (sat.aparece_en_ml_trends ? 30 : 0))
    : 0

  let margenMxn = 0, margenPct = 0, margenValido = false
  if (margin?.precio_origen_usd != null && margin?.precio_venta_estimado_mxn != null) {
    const costo = (margin.precio_origen_usd * margin.tipo_cambio + margin.costo_envio_importacion_mxn)
      * (1 + margin.arancel_pct / 100) * (1 + margin.iva_pct / 100)
    margenMxn = margin.precio_venta_estimado_mxn - costo
    margenPct = margin.precio_venta_estimado_mxn > 0 ? (margenMxn / margin.precio_venta_estimado_mxn) * 100 : 0
    margenValido = true
  }

  const base = momentumScore - 0.7 * satScore
  const oppScore = margenValido ? (margenMxn > 0 ? Math.max(0, base) : 0) : Math.max(0, base)

  return { momentumScore, satScore, margenMxn, margenPct, oppScore }
}

Deno.serve(async () => {
  const { data: products } = await supabase
    .from('products')
    .select('id, keyword_busqueda')
    .neq('estado', 'descartado')

  if (!products?.length) return new Response(JSON.stringify({ ok: true, procesados: 0 }))

  const token = await obtenerMLToken()
  const tendencias = token ? await obtenerTendenciasML(token) : []

  let procesados = 0
  for (const product of products) {
    try {
      const mlResult = await buscarEnML(product.keyword_busqueda)
      const aparece_en_ml_trends = tendencias.some((t) =>
        t.includes(product.keyword_busqueda.toLowerCase())
      )

      await supabase.from('mx_saturation').insert({
        product_id: product.id,
        ...mlResult,
        num_publicaciones: mlResult.numPublicaciones,
        precio_min: mlResult.precioMin,
        precio_max: mlResult.precioMax,
        precio_mediana: mlResult.precioMediana,
        aparece_en_ml_trends,
      })

      const [{ data: signals }, { data: margin }] = await Promise.all([
        supabase.from('trend_signals').select('*').eq('product_id', product.id),
        supabase.from('margin_inputs').select('*').eq('product_id', product.id).single(),
      ])

      const satFake = { num_publicaciones: mlResult.numPublicaciones, aparece_en_ml_trends }
      const score = calcularOportunidad(signals ?? [], satFake, margin)

      await supabase.from('opportunities').upsert({
        product_id: product.id,
        momentum_score: score.momentumScore,
        saturacion_score: score.satScore,
        margen_estimado_mxn: score.margenMxn,
        margen_pct: score.margenPct,
        opportunity_score: score.oppScore,
        actualizado_at: new Date().toISOString(),
      })

      procesados++
      // Evitar rate-limit de ML
      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      console.error(`Error procesando ${product.id}:`, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, procesados }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
