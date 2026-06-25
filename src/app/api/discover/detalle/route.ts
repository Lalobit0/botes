import { NextResponse } from 'next/server'
import { getProductoDetalle } from '@/lib/aliexpress/api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const detalle = await getProductoDetalle(id)
  if (!detalle) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })

  return NextResponse.json(detalle)
}
