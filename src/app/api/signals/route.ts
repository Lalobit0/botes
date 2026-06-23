import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { product_id, fuente, pais = 'US', tipo_metrica, valor, rank, tier } = body

  if (!product_id || !fuente || !tipo_metrica) {
    return NextResponse.json(
      { error: 'product_id, fuente y tipo_metrica son requeridos' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('radar_trend_signals')
    .insert({ product_id, fuente, pais, tipo_metrica, valor, rank, tier })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
