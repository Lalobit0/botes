import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('radar_products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { nombre, keyword_busqueda, categoria, nicho, notas } = body
  if (!nombre || !keyword_busqueda) {
    return NextResponse.json({ error: 'nombre y keyword_busqueda son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('radar_products')
    .insert({ nombre, keyword_busqueda, categoria, nicho, notas })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
