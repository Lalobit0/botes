import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buscarEnML, obtenerTendenciasML, obtenerAccessToken } from '@/lib/ml/api'
import { calcularOportunidad } from '@/lib/scoring'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const supabase = await createClient()

  const { data: product, error: prodError } = await supabase
    .from('radar_products')
    .select('keyword_busqueda')
    .eq('id', productId)
    .single()

  if (prodError || !product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  try {
    const mlResult = await buscarEnML(product.keyword_busqueda)

    let aparece_en_ml_trends = false
    if (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) {
      try {
        const token = await obtenerAccessToken()
        const tendencias = await obtenerTendenciasML(token)
        aparece_en_ml_trends = tendencias.some((t) =>
          t.includes(product.keyword_busqueda.toLowerCase())
        )
      } catch {}
    }

    const { error: satError } = await supabase.from('radar_mx_saturation').insert({
      product_id: productId,
      num_publicaciones: mlResult.numPublicaciones,
      precio_min: mlResult.precioMin,
      precio_max: mlResult.precioMax,
      precio_mediana: mlResult.precioMediana,
      aparece_en_ml_trends,
    })

    if (satError) throw new Error(satError.message)

    const [signalsRes, marginRes] = await Promise.all([
      supabase.from('radar_trend_signals').select('*').eq('product_id', productId),
      supabase.from('radar_margin_inputs').select('*').eq('product_id', productId).single(),
    ])

    const satForScore = {
      id: 'tmp',
      product_id: productId,
      num_publicaciones: mlResult.numPublicaciones,
      precio_min: mlResult.precioMin,
      precio_max: mlResult.precioMax,
      precio_mediana: mlResult.precioMediana,
      aparece_en_ml_trends,
      capturado_at: new Date().toISOString(),
    }

    const score = calcularOportunidad(signalsRes.data ?? [], satForScore, marginRes.data ?? null)

    await supabase.from('radar_opportunities').upsert({
      product_id: productId,
      momentum_score: score.momentumScore,
      saturacion_score: score.saturacionScore,
      margen_estimado_mxn: score.margenMxn,
      margen_pct: score.margenPct,
      opportunity_score: score.opportunityScore,
      actualizado_at: new Date().toISOString(),
    })

    return NextResponse.json({ saturation: mlResult, aparece_en_ml_trends, score })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
