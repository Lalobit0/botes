import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProductEstado } from '@/lib/supabase/types'

interface OppRow {
  id: string
  nombre: string
  nicho: string | null
  estado: ProductEstado
  created_at: string
  radar_opportunities: { opportunity_score: number | null } | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const nicho = searchParams.get('nicho')
  const estado = searchParams.get('estado') as ProductEstado | null

  let query = supabase
    .from('radar_products')
    .select(`
      *,
      radar_opportunities(*),
      radar_mx_saturation(num_publicaciones, precio_mediana, aparece_en_ml_trends, capturado_at)
    `)

  if (nicho) query = query.eq('nicho', nicho)
  if (estado) query = query.eq('estado', estado)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (query as any)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = ((data ?? []) as OppRow[]).sort((a, b) => {
    const sa = a.radar_opportunities?.opportunity_score ?? 0
    const sb = b.radar_opportunities?.opportunity_score ?? 0
    return sb - sa
  })

  return NextResponse.json(sorted)
}
