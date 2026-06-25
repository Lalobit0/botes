import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  searchAliexpressProducts,
  aliexpressConfigurado,
  NICHO_KEYWORDS,
  type AliexpressProduct,
} from '@/lib/aliexpress/api'
import { obtenerAccessToken, obtenerTendenciasML } from '@/lib/ml/api'

const mlConfigurado = () => !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const nicho = searchParams.get('nicho') || ''
  const sort = searchParams.get('sort') || 'LAST_VOLUME_DESC'
  const country = searchParams.get('country') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const wantChips = searchParams.get('chips') === '1'
  const minPriceUsd = parseFloat(searchParams.get('minp') || '') || undefined
  const maxPriceUsd = parseFloat(searchParams.get('maxp') || '') || undefined

  const keywords = q || NICHO_KEYWORDS[nicho] || 'gadget'

  const productos: AliexpressProduct[] =
    (await searchAliexpressProducts({
      keywords,
      sort,
      shipToCountry: country,
      page,
      minPriceUsd,
      maxPriceUsd,
    })) ?? []

  let tendenciasMx: string[] = []
  if (wantChips && mlConfigurado()) {
    try {
      const token = await obtenerAccessToken()
      tendenciasMx = (await obtenerTendenciasML(token)).slice(0, 14)
    } catch {}
  }

  return NextResponse.json({
    sources: { aliexpress: aliexpressConfigurado(), mercadolibre_mx: mlConfigurado() },
    q,
    nicho,
    sort,
    country,
    page,
    productos,
    tendenciasMx,
  })
}

function inferirNicho(categoria: string | null): string | null {
  if (!categoria) return null
  const c = categoria.toLowerCase()
  if (/kitchen|food|cook|appliance/i.test(c)) return 'cocina'
  if (/beauty|hair|skin|nail|makeup|cosmetic/i.test(c)) return 'belleza'
  if (/electron|phone|computer|tech|gadget|camera/i.test(c)) return 'tech'
  if (/home|furniture|garden|storage/i.test(c)) return 'hogar'
  if (/pet|dog|cat|animal/i.test(c)) return 'mascotas'
  if (/sport|fitness|exercise|gym/i.test(c)) return 'fitness'
  if (/fashion|cloth|wear|shoe|bag|accessory/i.test(c)) return 'moda'
  if (/baby|kid|child|infant|toy/i.test(c)) return 'bebe'
  if (/car|auto|vehicle/i.test(c)) return 'auto'
  if (/tool|hardware|diy/i.test(c)) return 'herramientas'
  return null
}

// Acepta un producto de AliExpress y lo da de alta para evaluarlo.
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = (await request.json()) as Partial<AliexpressProduct> & { nota?: string }

  if (!body.nombre || !body.keyword) {
    return NextResponse.json({ error: 'nombre y keyword requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('radar_products')
    .insert({
      nombre: body.nombre,
      keyword_busqueda: body.keyword,
      nicho: inferirNicho(body.categoria ?? null),
      notas: body.url ? `AliExpress — ${body.url}` : 'AliExpress',
      imagen_url: body.imagen ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.ordenes != null) {
    await supabase.from('radar_trend_signals').insert({
      product_id: data.id,
      fuente: 'aliexpress',
      pais: 'US',
      tipo_metrica: 'growth_pct',
      valor: body.ordenes,
    })
  }

  if (body.precioUsd != null) {
    await supabase.from('radar_margin_inputs').upsert({
      product_id: data.id,
      precio_origen_usd: body.precioUsd,
      tipo_cambio: 18.0,
      costo_envio_importacion_mxn: 0,
      arancel_pct: 0,
      iva_pct: 16,
    })
  }

  return NextResponse.json(data, { status: 201 })
}
