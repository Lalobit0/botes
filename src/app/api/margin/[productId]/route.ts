import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularOportunidad } from '@/lib/scoring'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const supabase = await createClient()
  const body = await request.json()

  const inputs = {
    product_id: productId,
    precio_origen_usd: body.precio_origen_usd ?? null,
    tipo_cambio: body.tipo_cambio ?? 18.0,
    costo_envio_importacion_mxn: body.costo_envio_importacion_mxn ?? 0,
    arancel_pct: body.arancel_pct ?? 0,
    iva_pct: body.iva_pct ?? 16,
    precio_venta_estimado_mxn: body.precio_venta_estimado_mxn ?? null,
  }

  const { data, error } = await supabase
    .from('radar_margin_inputs')
    .upsert(inputs)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [signalsRes, satRes] = await Promise.all([
    supabase.from('radar_trend_signals').select('*').eq('product_id', productId),
    supabase.from('radar_mx_saturation').select('*').eq('product_id', productId).order('capturado_at', { ascending: false }).limit(1),
  ])

  const signals = signalsRes.data ?? []
  const saturation = satRes.data?.[0] ?? null
  const score = calcularOportunidad(signals, saturation, inputs)

  await supabase.from('radar_opportunities').upsert({
    product_id: productId,
    momentum_score: score.momentumScore,
    saturacion_score: score.saturacionScore,
    margen_estimado_mxn: score.margenMxn,
    margen_pct: score.margenPct,
    opportunity_score: score.opportunityScore,
    actualizado_at: new Date().toISOString(),
  })

  return NextResponse.json({ margin: data, score })
}
