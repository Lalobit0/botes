import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerAccessToken, obtenerTendenciasML } from '@/lib/ml/api'
import { calcularOportunidad } from '@/lib/scoring'

async function recalcularScore(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const [signalsRes, marginRes, satRes] = await Promise.all([
    supabase.from('radar_trend_signals').select('*').eq('product_id', productId),
    supabase.from('radar_margin_inputs').select('*').eq('product_id', productId).maybeSingle(),
    supabase
      .from('radar_mx_saturation')
      .select('*')
      .eq('product_id', productId)
      .order('capturado_at', { ascending: false })
      .limit(1),
  ])
  const score = calcularOportunidad(signalsRes.data ?? [], satRes.data?.[0] ?? null, marginRes.data ?? null)
  await supabase.from('radar_opportunities').upsert({
    product_id: productId,
    momentum_score: score.momentumScore,
    saturacion_score: score.saturacionScore,
    margen_estimado_mxn: score.margenMxn,
    margen_pct: score.margenPct,
    opportunity_score: score.opportunityScore,
    actualizado_at: new Date().toISOString(),
  })
  return score
}

// Auto-fetch de saturación desde la API pública de Mercado Libre MX.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('radar_products')
    .select('keyword_busqueda')
    .eq('id', productId)
    .single()

  if (!product) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })

  const q = encodeURIComponent(product.keyword_busqueda.trim())
  let total = 0
  let precioMin: number | null = null
  let precioMax: number | null = null
  let precioMediana: number | null = null

  try {
    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLM/search?q=${q}&limit=50`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
    )
    if (!res.ok) return NextResponse.json({ error: `ML ${res.status}` }, { status: 502 })

    const data = await res.json()
    total = (data.paging?.total as number) ?? 0
    const prices: number[] = ((data.results ?? []) as Array<{ price: number }>)
      .map((i) => Number(i.price))
      .filter((p) => p > 0)
      .sort((a, b) => a - b)
    if (prices.length) {
      precioMin = prices[0]
      precioMax = prices[prices.length - 1]
      precioMediana = prices[Math.floor(prices.length / 2)]
    }
  } catch {
    return NextResponse.json({ error: 'ML no disponible' }, { status: 502 })
  }

  let aparece_en_ml_trends = false
  if (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) {
    try {
      const token = await obtenerAccessToken()
      const tendencias = await obtenerTendenciasML(token)
      const kw = product.keyword_busqueda.toLowerCase()
      aparece_en_ml_trends = tendencias.some((t) => t.includes(kw.split(' ')[0]) || kw.includes(t))
    } catch {}
  }

  const { error: satError } = await supabase.from('radar_mx_saturation').insert({
    product_id: productId,
    num_publicaciones: total,
    precio_min: precioMin,
    precio_max: precioMax,
    precio_mediana: precioMediana,
    aparece_en_ml_trends,
  })
  if (satError) return NextResponse.json({ error: satError.message }, { status: 500 })

  const score = await recalcularScore(supabase, productId)

  return NextResponse.json({ ok: true, total, precioMin, precioMax, precioMediana, aparece_en_ml_trends, score })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const supabase = await createClient()
  const body = await request.json()

  const { data: product } = await supabase
    .from('radar_products')
    .select('keyword_busqueda')
    .eq('id', productId)
    .single()

  // El flag "aparece en tendencias MX" sí lo podemos calcular solo (la API
  // /trends sí funciona con token de app).
  let aparece_en_ml_trends = false
  if (product && process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) {
    try {
      const token = await obtenerAccessToken()
      const tendencias = await obtenerTendenciasML(token)
      aparece_en_ml_trends = tendencias.some((t) =>
        t.includes(product.keyword_busqueda.toLowerCase())
      )
    } catch {}
  }

  const num = body.num_publicaciones != null ? Math.round(Number(body.num_publicaciones)) : null
  const precioMin = body.precio_min != null ? Number(body.precio_min) : null
  const precioMax = body.precio_max != null ? Number(body.precio_max) : null
  // Si no mandan mediana, usamos el promedio de min/max como aproximación.
  const precioMediana =
    body.precio_mediana != null
      ? Number(body.precio_mediana)
      : precioMin != null && precioMax != null
        ? (precioMin + precioMax) / 2
        : (precioMin ?? precioMax)

  const { error: satError } = await supabase.from('radar_mx_saturation').insert({
    product_id: productId,
    num_publicaciones: num,
    precio_min: precioMin,
    precio_max: precioMax,
    precio_mediana: precioMediana,
    aparece_en_ml_trends,
  })

  if (satError) return NextResponse.json({ error: satError.message }, { status: 500 })

  const score = await recalcularScore(supabase, productId)
  return NextResponse.json({ ok: true, aparece_en_ml_trends, score })
}
