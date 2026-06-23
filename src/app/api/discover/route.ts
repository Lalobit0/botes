import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAliexpressHotProducts, aliexpressConfigurado } from '@/lib/aliexpress/api'
import { obtenerAccessToken, obtenerTendenciasML } from '@/lib/ml/api'

export interface Sugerencia {
  nombre: string
  keyword: string
  fuente: 'aliexpress' | 'mercadolibre_mx'
  precioUsd?: number | null
  imagen?: string | null
  url?: string | null
  ordenes?: number | null
  nota?: string
}

const mlConfigurado = () => !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET)

export async function GET() {
  const sugerencias: Sugerencia[] = []

  // 1. AliExpress hot products (descubrimiento de afuera)
  const ali = await getAliexpressHotProducts()
  if (ali) {
    for (const p of ali) {
      sugerencias.push({
        nombre: p.nombre,
        keyword: p.keyword,
        fuente: 'aliexpress',
        precioUsd: p.precioUsd,
        imagen: p.imagen,
        url: p.url,
        ordenes: p.ordenes,
      })
    }
  }

  // 2. Tendencias de Mercado Libre MX (semilla / referencia local)
  if (mlConfigurado()) {
    try {
      const token = await obtenerAccessToken()
      const keywords = await obtenerTendenciasML(token)
      for (const kw of keywords.slice(0, 25)) {
        sugerencias.push({
          nombre: kw,
          keyword: kw,
          fuente: 'mercadolibre_mx',
          nota: 'Ya es tendencia en MX (referencia)',
        })
      }
    } catch {}
  }

  return NextResponse.json({
    sources: {
      aliexpress: aliexpressConfigurado(),
      mercadolibre_mx: mlConfigurado(),
    },
    sugerencias,
  })
}

// Acepta una sugerencia y la da de alta como producto
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = (await request.json()) as Sugerencia

  if (!body.nombre || !body.keyword) {
    return NextResponse.json({ error: 'nombre y keyword requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('radar_products')
    .insert({
      nombre: body.nombre,
      keyword_busqueda: body.keyword,
      notas: body.url ? `Origen: ${body.fuente} — ${body.url}` : `Origen: ${body.fuente}`,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si viene de AliExpress, guardamos una señal de momentum con sus órdenes
  if (body.fuente === 'aliexpress' && body.ordenes != null) {
    await supabase.from('radar_trend_signals').insert({
      product_id: data.id,
      fuente: 'aliexpress',
      pais: 'US',
      tipo_metrica: 'growth_pct',
      valor: body.ordenes,
    })
  }

  return NextResponse.json(data, { status: 201 })
}
