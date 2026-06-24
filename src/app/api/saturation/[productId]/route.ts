import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerAccessToken, obtenerTendenciasML } from '@/lib/ml/api'
import { calcularOportunidad } from '@/lib/scoring'

// Captura manual de la saturación en Mercado Libre MX.
// ML cerró su API de búsqueda (403) y bloquea el scraping (anti-bot), así que
// el usuario pega lo que ve al buscar en ML desde su dispositivo.
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

  // Recalcular el score con la saturación recién capturada.
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

  const score = calcularOportunidad(
    signalsRes.data ?? [],
    satRes.data?.[0] ?? null,
    marginRes.data ?? null
  )

  await supabase.from('radar_opportunities').upsert({
    product_id: productId,
    momentum_score: score.momentumScore,
    saturacion_score: score.saturacionScore,
    margen_estimado_mxn: score.margenMxn,
    margen_pct: score.margenPct,
    opportunity_score: score.opportunityScore,
    actualizado_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, aparece_en_ml_trends, score })
}
