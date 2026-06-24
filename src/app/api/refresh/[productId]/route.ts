import { NextResponse } from 'next/server'
import { obtenerTendenciasML, obtenerAccessToken } from '@/lib/ml/api'
import { createClient } from '@/lib/supabase/server'
import { getGoogleTrendsMomentum } from '@/lib/google/trends'
import { calcularOportunidad } from '@/lib/scoring'

// Refresca lo que SÍ se puede automatizar: el momentum de Google Trends y el
// flag de tendencias de ML. La saturación (publicaciones/precios) ya no se
// puede obtener automáticamente (ML cierra su API y bloquea el scraping), así
// que se captura a mano en /api/saturation. Aquí solo se reutiliza la última.
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
    // Flag de tendencias locales: la API /trends sí funciona con token de app.
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

    // Momentum automático desde Google Trends (US). Reemplaza la señal anterior.
    let googleScore: number | null = null
    const gt = await getGoogleTrendsMomentum(product.keyword_busqueda)
    if (gt) {
      googleScore = gt.score
      await supabase
        .from('radar_trend_signals')
        .delete()
        .eq('product_id', productId)
        .eq('fuente', 'google_trends')
      await supabase.from('radar_trend_signals').insert({
        product_id: productId,
        fuente: 'google_trends',
        pais: 'US',
        tipo_metrica: 'search_slope',
        valor: gt.score,
      })
    }

    // Si ya hay una saturación capturada, actualizamos su flag de tendencias.
    const { data: latestSat } = await supabase
      .from('radar_mx_saturation')
      .select('*')
      .eq('product_id', productId)
      .order('capturado_at', { ascending: false })
      .limit(1)

    const saturation = latestSat?.[0] ?? null
    if (saturation && saturation.aparece_en_ml_trends !== aparece_en_ml_trends) {
      await supabase
        .from('radar_mx_saturation')
        .update({ aparece_en_ml_trends })
        .eq('id', saturation.id)
      saturation.aparece_en_ml_trends = aparece_en_ml_trends
    }

    const [signalsRes, marginRes] = await Promise.all([
      supabase.from('radar_trend_signals').select('*').eq('product_id', productId),
      supabase.from('radar_margin_inputs').select('*').eq('product_id', productId).maybeSingle(),
    ])

    const score = calcularOportunidad(signalsRes.data ?? [], saturation, marginRes.data ?? null)

    await supabase.from('radar_opportunities').upsert({
      product_id: productId,
      momentum_score: score.momentumScore,
      saturacion_score: score.saturacionScore,
      margen_estimado_mxn: score.margenMxn,
      margen_pct: score.margenPct,
      opportunity_score: score.opportunityScore,
      actualizado_at: new Date().toISOString(),
    })

    return NextResponse.json({
      aparece_en_ml_trends,
      google_trends: googleScore,
      saturacion: saturation,
      score,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[refresh] error:', msg, err instanceof Error ? err.stack : '')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
