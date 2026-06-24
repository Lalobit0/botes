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

export async function getAliexpressHotProducts(
  categoryIds?: string
): Promise<AliexpressProduct[] | null> {
  const appKey = process.env.ALIEXPRESS_APP_KEY
  const secret = process.env.ALIEXPRESS_APP_SECRET
  if (!appKey || !secret) return null

  const params: Record<string, string> = {
    method: 'aliexpress.affiliate.hotproduct.query',
    app_key: appKey,
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    format: 'json',
    v: '2.0',
    target_currency: 'USD',
    target_language: 'EN',
    page_size: '20',
    page_no: '1',
    ...(categoryIds ? { category_ids: categoryIds } : {}),
  }
  params.sign = firmar(params, secret)

  try {
    const res = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    })
    if (!res.ok) {
      console.warn(`[aliexpress] HTTP ${res.status} al consultar hot products`)
      return []
    }
    const json = await res.json()

    // AliExpress reporta errores de firma/permiso dentro de error_response.
    // Lo más común al estrenar credenciales: el paquete de Affiliate API aún no
    // está aprobado. Lo dejamos visible en logs para diagnosticar al instante.
    if (json?.error_response) {
      console.warn('[aliexpress] error_response:', JSON.stringify(json.error_response))
      return []
    }

    // La estructura puede variar; navegamos defensivamente.
    const result =
      json?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result ??
      json?.resp_result?.result
    const products = result?.products?.product ?? result?.products ?? []

    return (Array.isArray(products) ? products : []).map(
      (p: Record<string, unknown>): AliexpressProduct => ({
        nombre: String(p.product_title ?? 'Producto AliExpress'),
        keyword: String(p.product_title ?? '').split(' ').slice(0, 4).join(' '),
        precioUsd: p.target_sale_price ? Number(p.target_sale_price) : null,
        imagen: (p.product_main_image_url as string) ?? null,
        url: (p.promotion_link as string) ?? (p.product_detail_url as string) ?? null,
        ordenes: p.lastest_volume ? Number(p.lastest_volume) : null,
      })
    )
  } catch (err) {
    console.warn('[aliexpress] excepción al consultar hot products:', err)
    return []
  }
}
