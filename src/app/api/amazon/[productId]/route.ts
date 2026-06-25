import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularOportunidad } from '@/lib/scoring'

// Guarda la señal Amazon US para un producto (upsert: reemplaza la anterior).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const supabase = await createClient()
  const body = await request.json()

  const resultados: number | null = body.resultados != null ? Number(body.resultados) : null
  const precioUsd: number | null = body.precioUsd != null ? Number(body.precioUsd) : null
  const bsr: number | null = body.bsr != null ? Number(body.bsr) : null

  // Score derivado: log10(resultados) normalizado 0-100 como proxy de demanda.
  const valor =
    resultados != null && resultados > 0
      ? Math.min(100, Math.round(Math.log10(resultados + 1) * 30))
      : null

  // Reemplaza señales previas de amazon_us
  await supabase.from('radar_trend_signals').delete().eq('product_id', productId).eq('fuente', 'amazon_us')

  const { error } = await supabase.from('radar_trend_signals').insert({
    product_id: productId,
    fuente: 'amazon_us',
    pais: 'US',
    tipo_metrica: 'search_slope',
    valor,
    rank: bsr,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Guardar precio como referencia (sin afectar scoring)
  if (precioUsd != null) {
    await supabase.from('radar_trend_signals').insert({
      product_id: productId,
      fuente: 'amazon_us',
      pais: 'US',
      tipo_metrica: 'precio_usd',
      valor: precioUsd,
    })
  }

  // Recalcular score
  const [signalsRes, satRes, marginRes] = await Promise.all([
    supabase.from('radar_trend_signals').select('*').eq('product_id', productId),
    supabase
      .from('radar_mx_saturation')
      .select('*')
      .eq('product_id', productId)
      .order('capturado_at', { ascending: false })
      .limit(1),
    supabase.from('radar_margin_inputs').select('*').eq('product_id', productId).maybeSingle(),
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

  return NextResponse.json({ ok: true, valor, score })
}
