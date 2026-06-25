// Integración con la Open Platform de AliExpress (API de afiliados).
// Requiere registro de desarrollador: ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET.
// Si no hay credenciales, devuelve null (feature flag implícito).

import crypto from 'crypto'

const GATEWAY = 'https://api-sg.aliexpress.com/sync'

export interface AliexpressProduct {
  nombre: string
  keyword: string
  precioUsd: number | null
  imagen: string | null
  url: string | null
  ordenes: number | null
}

function firmar(params: Record<string, string>, secret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('')
  return crypto.createHmac('sha256', secret).update(base, 'utf8').digest('hex').toUpperCase()
}

export function aliexpressConfigurado(): boolean {
  return !!(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET)
}

// Llama un método firmado de la Open Platform. Devuelve el JSON crudo, o null si
// no hay credenciales, hubo error HTTP, o AliExpress devolvió un error_response
// (firma/permiso). El motivo siempre queda en logs para diagnóstico inmediato.
async function llamarAli(method: string, extra: Record<string, string>) {
  const appKey = process.env.ALIEXPRESS_APP_KEY
  const secret = process.env.ALIEXPRESS_APP_SECRET
  if (!appKey || !secret) return null

  const params: Record<string, string> = {
    method,
    app_key: appKey,
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    format: 'json',
    v: '2.0',
    target_currency: 'USD',
    target_language: 'EN',
    ...extra,
  }
  params.sign = firmar(params, secret)

  try {
    const res = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    })
    if (!res.ok) {
      console.warn(`[aliexpress] HTTP ${res.status} en ${method}`)
      return null
    }
    const json = await res.json()
    if (json?.error_response) {
      console.warn(`[aliexpress] ${method} error_response:`, JSON.stringify(json.error_response))
      return null
    }
    return json
  } catch (err) {
    console.warn(`[aliexpress] excepción en ${method}:`, err)
    return null
  }
}

function mapearProductos(products: unknown): AliexpressProduct[] {
  const lista = Array.isArray(products) ? products : []
  return lista.map(
    (p: Record<string, unknown>): AliexpressProduct => ({
      nombre: String(p.product_title ?? 'Producto AliExpress'),
      keyword: String(p.product_title ?? '').split(' ').slice(0, 4).join(' '),
      precioUsd: p.target_sale_price ? Number(p.target_sale_price) : null,
      imagen: (p.product_main_image_url as string) ?? null,
      url: (p.promotion_link as string) ?? (p.product_detail_url as string) ?? null,
      ordenes: p.lastest_volume ? Number(p.lastest_volume) : null,
    })
  )
}

// Descubrimiento de productos. Intenta "hot products"; si esa API no tiene
// permiso (común en cuentas nuevas), cae a la búsqueda de productos por keyword,
// que suele estar disponible y es más útil para productos específicos.
export async function getAliexpressHotProducts(
  categoryIds?: string
): Promise<AliexpressProduct[] | null> {
  if (!aliexpressConfigurado()) return null

  const hot = await llamarAli('aliexpress.affiliate.hotproduct.query', {
    page_size: '20',
    page_no: '1',
    ...(categoryIds ? { category_ids: categoryIds } : {}),
  })
  const hotResult =
    hot?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result ??
    hot?.resp_result?.result
  const hotProducts = hotResult?.products?.product ?? hotResult?.products
  if (Array.isArray(hotProducts) && hotProducts.length) return mapearProductos(hotProducts)

  // Fallback: productos más vendidos por una keyword amplia.
  const fallback = await searchAliexpressProducts('gadget')
  return fallback ?? []
}

// Búsqueda de productos específicos por palabra clave (ordenados por ventas).
export async function searchAliexpressProducts(
  keywords: string
): Promise<AliexpressProduct[] | null> {
  if (!aliexpressConfigurado()) return null

  const json = await llamarAli('aliexpress.affiliate.product.query', {
    keywords,
    page_size: '20',
    page_no: '1',
    sort: 'LAST_VOLUME_DESC',
  })
  if (!json) return []

  const result =
    json?.aliexpress_affiliate_product_query_response?.resp_result?.result ??
    json?.resp_result?.result
  const products = result?.products?.product ?? result?.products
  return mapearProductos(products)
}
