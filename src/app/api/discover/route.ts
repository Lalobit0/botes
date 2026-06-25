import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  searchAliexpressProducts,
  aliexpressConfigurado,
  NICHO_KEYWORDS,
  getPromocionesActivas,
  getProductosPromo,
  type AliexpressProduct,
  type AliexpressPromo,
} from '@/lib/aliexpress/api'
import { obtenerAccessToken, obtenerTendenciasML } from '@/lib/ml/api'

const mlConfigurado = () => !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const nicho = searchParams.get('nicho') || ''
  const sort = searchParams.get('sort') || 'LAST_VOLUME_DESC'
  const country = searchParams.get('country') || ''
  const promo = searchParams.get('promo') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const wantChips = searchParams.get('chips') === '1'
  const minPriceUsd = parseFloat(searchParams.get('minp') || '') || undefined
  const maxPriceUsd = parseFloat(searchParams.get('maxp') || '') || undefined

  // Keyword efectiva: búsqueda libre > nicho > default amplio de "ganadores".
  const keywords = q || NICHO_KEYWORDS[nicho] || 'gadget'

  let productos: AliexpressProduct[] = []
  if (promo) {
    productos = (await getProductosPromo(promo, page)) ?? []
  } else {
    productos =
      (await searchAliexpressProducts({
        keywords,
        sort,
        shipToCountry: country,
        page,
        minPriceUsd,
        maxPriceUsd,
      })) ?? []
  }

  // Tendencias de Mercado Libre MX y promociones AliExpress: solo al inicio.
  let tendenciasMx: string[] = []
  let promociones: AliexpressPromo[] = []
  if (wantChips) {
    if (mlConfigurado()) {
      try {
        const token = await obtenerAccessToken()
        tendenciasMx = (await obtenerTendenciasML(token)).slice(0, 14)
      } catch {}
    }
    if (aliexpressConfigurado()) {
      try {
        promociones = (await getPromocionesActivas()) ?? []
      } catch {}
    }
  }

  return NextResponse.json({
    sources: { aliexpress: aliexpressConfigurado(), mercadolibre_mx: mlConfigurado() },
    q,
    nicho,
    sort,
    country,
    promo,
    page,
    productos,
    tendenciasMx,
    promociones,
  })
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
      notas: body.url ? `AliExpress — ${body.url}` : 'AliExpress',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Señal de momentum con el volumen de órdenes de AliExpress.
  if (body.ordenes != null) {
    await supabase.from('radar_trend_signals').insert({
      product_id: data.id,
      fuente: 'aliexpress',
      pais: 'US',
      tipo_metrica: 'growth_pct',
      valor: body.ordenes,
    })
  }

  // Pre-llena la calculadora de margen con el precio de compra (USD).
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
