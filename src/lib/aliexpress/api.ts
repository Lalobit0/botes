// Integración con la Open Platform de AliExpress (API de afiliados).
// Requiere registro de desarrollador: ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET.
// Si no hay credenciales, devuelve null (feature flag implícito).

import crypto from 'crypto'

const GATEWAY = 'https://api-sg.aliexpress.com/sync'

export interface AliexpressProduct {
  nombre: string
  keyword: string
  precioUsd: number | null
  precioAppUsd: number | null
  precioOriginalUsd: number | null
  descuentoPct: number | null
  comisionPct: number | null
  imagen: string | null
  video: string | null
  url: string | null
  ordenes: number | null
  rating: number | null
  categoria: string | null
}

export interface BusquedaOpts {
  keywords?: string
  categoryIds?: string
  // LAST_VOLUME_DESC (más vendidos), SALE_PRICE_ASC, SALE_PRICE_DESC, etc.
  sort?: string
  shipToCountry?: string
  minPriceUsd?: number
  maxPriceUsd?: number
  page?: number
  pageSize?: number
}

// Campos que pedimos explícitamente para traer comisión, precio de app y video
// (que no vienen en el set por defecto).
const PRODUCT_FIELDS = [
  'product_id',
  'product_title',
  'product_main_image_url',
  'product_video_url',
  'target_sale_price',
  'target_app_sale_price',
  'target_original_price',
  'original_price',
  'sale_price',
  'discount',
  'evaluate_rate',
  'lastest_volume',
  'commission_rate',
  'promotion_link',
  'product_detail_url',
  'first_level_category_name',
  'second_level_category_name',
].join(',')

// Mapa nicho (es) → keyword de búsqueda (en, que es como responde mejor la API).
export const NICHO_KEYWORDS: Record<string, string> = {
  cocina: 'kitchen gadget',
  belleza: 'beauty tool',
  tech: 'smart gadget',
  hogar: 'home organizer',
  mascotas: 'pet supplies',
  fitness: 'fitness equipment',
  moda: 'fashion accessories',
  bebe: 'baby products',
  auto: 'car accessories',
  herramientas: 'tools gadget',
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
  if (process.env.ALIEXPRESS_TRACKING_ID) params.tracking_id = process.env.ALIEXPRESS_TRACKING_ID
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

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace('%', ''))
  return Number.isFinite(n) ? n : null
}

function mapearProductos(products: unknown): AliexpressProduct[] {
  const lista = Array.isArray(products) ? products : []
  return lista.map((p: Record<string, unknown>): AliexpressProduct => {
    const precio = num(p.target_sale_price ?? p.sale_price)
    const original = num(p.target_original_price ?? p.original_price)
    const descuento =
      precio != null && original != null && original > precio
        ? Math.round(((original - precio) / original) * 100)
        : null
    return {
      nombre: String(p.product_title ?? 'Producto AliExpress'),
      keyword: String(p.product_title ?? '').split(' ').slice(0, 4).join(' '),
      precioUsd: precio,
      precioAppUsd: num(p.target_app_sale_price),
      precioOriginalUsd: original,
      descuentoPct: descuento,
      comisionPct: num(p.commission_rate ?? p.hot_product_commission_rate),
      imagen: (p.product_main_image_url as string) ?? null,
      video: (p.product_video_url as string) || null,
      url: (p.promotion_link as string) ?? (p.product_detail_url as string) ?? null,
      ordenes: num(p.lastest_volume),
      rating: num(p.evaluate_rate),
      categoria:
        (p.first_level_category_name as string) ??
        (p.second_level_category_name as string) ??
        null,
    }
  })
}

function get(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key]
  }
  return undefined
}

function extraerProductos(json: unknown, responseKey: string): AliexpressProduct[] {
  // Estructura: <responseKey>.resp_result.result.products.product[]  (o sin el wrapper).
  const wrapper = get(json, responseKey) ?? json
  const result = get(get(wrapper, 'resp_result'), 'result')
  const holder = get(result, 'products')
  const products = Array.isArray(holder) ? holder : get(holder, 'product')
  return mapearProductos(products)
}

// Búsqueda de productos (ordenable por ventas/precio, filtrable por país de envío).
// Es la API base del explorador: "aliexpress.affiliate.product.query".
export async function searchAliexpressProducts(
  opts: BusquedaOpts
): Promise<AliexpressProduct[] | null> {
  if (!aliexpressConfigurado()) return null

  const extra: Record<string, string> = {
    page_no: String(opts.page ?? 1),
    page_size: String(opts.pageSize ?? 24),
    sort: opts.sort ?? 'LAST_VOLUME_DESC',
    fields: PRODUCT_FIELDS,
  }
  if (opts.keywords) extra.keywords = opts.keywords
  if (opts.categoryIds) extra.category_ids = opts.categoryIds
  if (opts.shipToCountry) extra.ship_to_country = opts.shipToCountry
  // min/max_sale_price van en centavos.
  if (opts.minPriceUsd) extra.min_sale_price = String(Math.round(opts.minPriceUsd * 100))
  if (opts.maxPriceUsd) extra.max_sale_price = String(Math.round(opts.maxPriceUsd * 100))

  const json = await llamarAli('aliexpress.affiliate.product.query', extra)
  if (!json) return []
  return extraerProductos(json, 'aliexpress_affiliate_product_query_response')
}

// Descubrimiento de productos ganadores. Intenta "hot products"; si esa API no
// tiene permiso (común en cuentas nuevas de afiliado), cae a la búsqueda normal.
export async function getAliexpressHotProducts(
  opts: BusquedaOpts = {}
): Promise<AliexpressProduct[] | null> {
  if (!aliexpressConfigurado()) return null

  const extra: Record<string, string> = {
    page_no: String(opts.page ?? 1),
    page_size: String(opts.pageSize ?? 24),
  }
  if (opts.keywords) extra.keywords = opts.keywords
  if (opts.categoryIds) extra.category_ids = opts.categoryIds
  if (opts.shipToCountry) extra.ship_to_country = opts.shipToCountry

  const hot = await llamarAli('aliexpress.affiliate.hotproduct.query', extra)
  const productos = hot ? extraerProductos(hot, 'aliexpress_affiliate_hotproduct_query_response') : []
  if (productos.length) return productos

  // Fallback: búsqueda normal ordenada por ventas.
  return searchAliexpressProducts({ ...opts, keywords: opts.keywords || 'gadget' })
}
