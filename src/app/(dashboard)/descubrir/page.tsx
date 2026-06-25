'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Search, Plus, ExternalLink, Check, Radar, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Producto {
  productoId: string | null
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

interface DiscoverResponse {
  sources: { aliexpress: boolean; mercadolibre_mx: boolean }
  productos: Producto[]
  tendenciasMx: string[]
}

const NICHOS = [
  { value: 'cocina', label: 'Cocina', emoji: '🍳' },
  { value: 'belleza', label: 'Belleza', emoji: '💄' },
  { value: 'tech', label: 'Tech', emoji: '📱' },
  { value: 'hogar', label: 'Hogar', emoji: '🏠' },
  { value: 'mascotas', label: 'Mascotas', emoji: '🐾' },
  { value: 'fitness', label: 'Fitness', emoji: '💪' },
  { value: 'moda', label: 'Moda', emoji: '👜' },
  { value: 'bebe', label: 'Bebé', emoji: '🍼' },
  { value: 'auto', label: 'Auto', emoji: '🚗' },
  { value: 'herramientas', label: 'Herram.', emoji: '🔧' },
]

// 'OPPORTUNITY' y 'GANANCIA_MXN' se reordenan del lado del cliente.
const SORTS = [
  { value: 'OPPORTUNITY', label: '🎯 Mejor oportunidad' },
  { value: 'GANANCIA_MXN', label: '💰 Mayor ganancia MXN' },
  { value: 'LAST_VOLUME_DESC', label: 'Más vendidos' },
  { value: 'SALE_PRICE_ASC', label: 'Precio: menor a mayor' },
  { value: 'SALE_PRICE_DESC', label: 'Precio: mayor a menor' },
]
const clientSort = (s: string) => s === 'OPPORTUNITY' || s === 'GANANCIA_MXN'
const apiSort = (s: string) => (clientSort(s) ? 'LAST_VOLUME_DESC' : s)

const PAISES = [
  { value: 'MX', label: '🇲🇽 Envío a México' },
  { value: '', label: '🌎 Global' },
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'ES', label: '🇪🇸 España' },
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'CO', label: '🇨🇴 Colombia' },
  { value: 'CL', label: '🇨🇱 Chile' },
]

const MARKUPS = [
  { value: 2, label: '2× (margen 50%)' },
  { value: 2.5, label: '2.5× (60%)' },
  { value: 3, label: '3× (67%)' },
  { value: 3.5, label: '3.5× (71%)' },
  { value: 4, label: '4× (75%)' },
]

const PAGE_SIZE = 24
const fmt = (n: number) => n.toLocaleString('es-MX')
const fmtMoney = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 })
const precioEfectivo = (p: Producto) =>
  Math.min(p.precioUsd ?? Infinity, p.precioAppUsd ?? Infinity)

export default function DescubrirPage() {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [nicho, setNicho] = useState('')
  const [sort, setSort] = useState('OPPORTUNITY')
  const [country, setCountry] = useState('MX')
  const [minp, setMinp] = useState('')
  const [maxp, setMaxp] = useState('')
  const [page, setPage] = useState(1)
  const [fx, setFx] = useState(18.5)
  const [markup, setMarkup] = useState(3)

  const [productos, setProductos] = useState<Producto[]>([])
  const [tendencias, setTendencias] = useState<string[]>([])
  const [minComision, setMinComision] = useState<number>(0)
  const [sources, setSources] = useState({ aliexpress: false, mercadolibre_mx: false })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  const [modalProducto, setModalProducto] = useState<Producto | null>(null)
  const [detalle, setDetalle] = useState<{ imagenesExtras: string[]; atributos: { nombre: string; valor: string }[] } | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)

  const fetchProductos = useCallback(
    async (o: {
      q: string
      nicho: string
      sort: string
      country: string
      minp?: string
      maxp?: string
      page: number
      chips?: boolean
      append?: boolean
    }) => {
      if (o.append) setLoadingMore(true)
      else setLoading(true)

      const params = new URLSearchParams()
      if (o.q) params.set('q', o.q)
      if (o.nicho) params.set('nicho', o.nicho)
      params.set('sort', apiSort(o.sort))
      if (o.country) params.set('country', o.country)
      if (o.minp) params.set('minp', o.minp)
      if (o.maxp) params.set('maxp', o.maxp)
      params.set('page', String(o.page))
      if (o.chips) params.set('chips', '1')

      try {
        const res = await fetch(`/api/discover?${params.toString()}`)
        const data: DiscoverResponse = await res.json()
        setSources(data.sources)
        if (o.chips && data.tendenciasMx?.length) setTendencias(data.tendenciasMx)
        setHasMore((data.productos?.length ?? 0) >= PAGE_SIZE)
        setProductos((prev) => (o.append ? [...prev, ...data.productos] : data.productos))
      } catch {
        if (!o.append) setProductos([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  const abrirModal = useCallback(async (p: Producto) => {
    setModalProducto(p)
    setDetalle(null)
    setImgIdx(0)
    if (!p.productoId) return
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/discover/detalle?id=${encodeURIComponent(p.productoId)}`)
      if (res.ok) {
        const data = await res.json()
        setDetalle({ imagenesExtras: data.imagenesExtras ?? [], atributos: data.atributos ?? [] })
      }
    } catch {}
    finally {
      setLoadingDetalle(false)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setModalProducto(null); setDetalle(null) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = modalProducto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalProducto])

  // Carga inicial (diferida para no setear estado de forma síncrona en el efecto).
  useEffect(() => {
    const id = setTimeout(() => {
      fetchProductos({ q: '', nicho: '', sort: 'OPPORTUNITY', country: 'MX', page: 1, chips: true })
    }, 0)
    return () => clearTimeout(id)
  }, [fetchProductos])

  // Reaplica con el estado actual (siempre vuelve a página 1).
  const aplicar = (over: Partial<Parameters<typeof fetchProductos>[0]> = {}) => {
    setPage(1)
    fetchProductos({ q, nicho, sort, country, minp, maxp, page: 1, ...over })
  }

  const buscar = (texto: string) => {
    setQ(texto)
    setNicho('')
    aplicar({ q: texto, nicho: '' })
  }

  const elegirNicho = (n: string) => {
    setNicho(n)
    setQ('')
    setText('')
    aplicar({ q: '', nicho: n })
  }

  const cambiarSort = (s: string) => {
    setSort(s)
    aplicar({ sort: s })
  }

  const cambiarPais = (c: string) => {
    setCountry(c)
    aplicar({ country: c })
  }

  const cargarMas = () => {
    const next = page + 1
    setPage(next)
    fetchProductos({ q, nicho, sort, country, minp, maxp, page: next, append: true })
  }

  const agregar = async (p: Producto) => {
    const key = p.url ?? p.nombre
    setAdding(key)
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, precioUsd: precioEfectivo(p) }),
      })
      if (res.ok) {
        const prod = await res.json()
        setAdded((prev) => new Set(prev).add(key))
        fetch(`/api/refresh/${prod.id}`, { method: 'POST' })
      }
    } finally {
      setAdding(null)
    }
  }

  const contexto = q
    ? `Resultados para "${q}"`
    : nicho
      ? NICHOS.find((n) => n.value === nicho)?.label ?? nicho
      : 'Productos ganadores'

  // Estimación de ganancia en MX: usa el mejor precio (web/app) + comisión afiliado.
  const estimar = (p: Producto) => {
    const precio = precioEfectivo(p)
    if (!Number.isFinite(precio)) return null
    const costo = precio * fx
    const sell = costo * markup
    const comisionMxn = costo * ((p.comisionPct ?? 0) / 100)
    const margen = sell - costo
    return {
      precio,
      costo,
      sell,
      comisionMxn,
      ganancia: margen + comisionMxn,
      margenPct: sell > 0 ? Math.round((margen / sell) * 100) : 0,
    }
  }

  // "Mejor oportunidad": demanda × comisión ÷ √precio → ganadores baratos con alta comisión.
  const displayProductos = useMemo(() => {
    let lista = productos
    if (minComision > 0) lista = lista.filter((p) => (p.comisionPct ?? 0) >= minComision)

    if (sort === 'OPPORTUNITY') {
      const score = (p: Producto) => {
        const precio = precioEfectivo(p)
        if (!Number.isFinite(precio) || precio <= 0) return -1
        const demanda = Math.log10((p.ordenes ?? 0) + 10)
        const comision = 1 + (p.comisionPct ?? 0) / 100
        return (demanda * comision) / Math.sqrt(precio)
      }
      return [...lista].sort((a, b) => score(b) - score(a))
    }

    if (sort === 'GANANCIA_MXN') {
      return [...lista].sort((a, b) => (estimar(b)?.ganancia ?? -1) - (estimar(a)?.ganancia ?? -1))
    }

    return lista
  }, [productos, sort, minComision, fx, markup]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-start gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-xl">
          <Radar size={20} className="text-indigo-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Descubrir</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Productos ganadores en AliExpress antes de que saturen México: precio de compra,
            comisión de afiliado y tu ganancia estimada por pieza.
          </p>
        </div>
        <div className="hidden sm:flex gap-1.5 text-xs shrink-0 pt-1">
          <span
            className={`px-2.5 py-1 rounded-full border ${
              sources.aliexpress
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            AliExpress {sources.aliexpress ? '●' : '○'}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full border ${
              sources.mercadolibre_mx
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            ML MX {sources.mercadolibre_mx ? '●' : '○'}
          </span>
        </div>
      </div>

      {/* Buscador + filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            buscar(text.trim())
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Busca un producto: mochila antirrobo, lámpara LED escritorio, organizador cocina…"
              className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <Button type="submit" size="md">
            <Search size={15} /> Buscar
          </Button>
        </form>

        {/* Nichos */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {NICHOS.map((n) => {
            const active = nicho === n.value && !q
            return (
              <button
                key={n.value}
                onClick={() => elegirNicho(n.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                <span className="mr-1">{n.emoji}</span>
                {n.label}
              </button>
            )
          })}
        </div>

        {/* Orden + país + rango de precio */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select
            value={sort}
            onChange={(e) => cambiarSort(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => cambiarPais(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {PAISES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center gap-1 text-xs text-gray-500">
            <span>Precio USD</span>
            <input
              type="number"
              min="0"
              value={minp}
              onChange={(e) => setMinp(e.target.value)}
              onBlur={() => aplicar()}
              onKeyDown={(e) => e.key === 'Enter' && aplicar()}
              placeholder="min"
              className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span>–</span>
            <input
              type="number"
              min="0"
              value={maxp}
              onChange={(e) => setMaxp(e.target.value)}
              onBlur={() => aplicar()}
              onKeyDown={(e) => e.key === 'Enter' && aplicar()}
              placeholder="max"
              className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Ganancia estimada: controles */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-600">💰 Ganancia estimada en MX:</span>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            Tipo de cambio
            <input
              type="number"
              step="0.1"
              min="1"
              value={fx}
              onChange={(e) => setFx(Number(e.target.value) || 0)}
              className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <select
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MARKUPS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            Comisión mín.
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={minComision || ''}
              onChange={(e) => setMinComision(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400">%</span>
          </label>
          <p className="w-full text-[11px] text-gray-400">
            Estimación rápida sobre el precio de compra (no incluye envío ni aduana). La comisión de
            afiliado es lo que AliExpress te paga por cada venta. Afina cada producto al darle
            "Evaluar".
          </p>
        </div>
      </div>

      {/* Tendencias de Mercado Libre MX como chips de búsqueda */}
      {tendencias.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">
            🔥 Tendencia ahora en Mercado Libre MX — búscalos en AliExpress:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tendencias.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setText(t)
                  buscar(t)
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-3">{contexto}</p>

      {/* Resultados */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="p-3.5 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">
            {sources.aliexpress
              ? 'Sin resultados. Prueba otra palabra clave o nicho.'
              : 'AliExpress no está configurado todavía.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayProductos.map((p, i) => {
              const key = p.url ?? p.nombre
              const isAdded = added.has(key)
              const ganador = (p.ordenes ?? 0) >= 5000
              const est = estimar(p)
              const usaApp =
                p.precioAppUsd != null && p.precioAppUsd < (p.precioUsd ?? Infinity)
              return (
                <div
                  key={`${key}-${i}`}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col"
                >
                  <div
                    className="relative aspect-square bg-gray-50 overflow-hidden cursor-pointer"
                    onClick={() => abrirModal(p)}
                  >
                    {p.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagen}
                        alt={p.nombre}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radar size={28} className="text-indigo-200" />
                      </div>
                    )}
                    {p.descuentoPct ? (
                      <span className="absolute top-2 left-2 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        -{p.descuentoPct}%
                      </span>
                    ) : null}
                    {ganador && (
                      <span className="absolute top-2 right-2 bg-amber-400/95 text-amber-950 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        🔥 Ganador
                      </span>
                    )}
                    {p.video && (
                      <a
                        href={p.video}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
                      >
                        ▶ Video
                      </a>
                    )}
                  </div>

                  <div className="p-3.5 flex flex-col gap-1.5 flex-1">
                    {p.categoria && (
                      <span className="text-[10px] uppercase tracking-wide text-indigo-500 font-semibold truncate">
                        {p.categoria}
                      </span>
                    )}
                    <h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                      {p.nombre}
                    </h3>

                    <div className="flex items-end gap-1.5 flex-wrap">
                      <span className="text-lg font-bold text-gray-900">
                        ${est ? est.precio.toFixed(2) : '—'}
                      </span>
                      <span className="text-[11px] text-gray-400 mb-0.5">USD</span>
                      {usaApp && (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded px-1 mb-0.5">
                          precio app
                        </span>
                      )}
                      {p.precioOriginalUsd && p.descuentoPct ? (
                        <span className="text-xs text-gray-400 line-through mb-0.5">
                          ${p.precioOriginalUsd.toFixed(2)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-gray-500 flex-wrap">
                      {p.ordenes != null && <span>📦 {fmt(p.ordenes)}</span>}
                      {p.rating != null && <span>★ {p.rating.toFixed(0)}%</span>}
                      {p.comisionPct != null && p.comisionPct > 0 && (
                        <span className="text-indigo-600 font-medium">💸 {p.comisionPct}%</span>
                      )}
                    </div>

                    {est && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Costo en MX</span>
                          <span className="font-medium text-gray-700">${fmtMoney(est.costo)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Vende ≈ ${fmtMoney(est.sell)}</span>
                          <span className="font-semibold text-emerald-700">+{est.margenPct}%</span>
                        </div>
                        {est.comisionMxn > 0 && (
                          <div className="flex items-center justify-between text-[11px] text-indigo-600">
                            <span>+ comisión afiliado</span>
                            <span>≈ ${fmtMoney(est.comisionMxn)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-800 border-t border-emerald-100 pt-1 mt-0.5">
                          <span>Ganancia / pieza</span>
                          <span>≈ ${fmtMoney(est.ganancia)}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center gap-2 pt-2">
                      {isAdded ? (
                        <span className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 rounded-lg py-2">
                          <Check size={14} /> Agregado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => agregar(p)}
                          loading={adding === key}
                          className="flex-1"
                        >
                          <Plus size={14} /> Evaluar
                        </Button>
                      )}
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Ver en AliExpress"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button variant="secondary" onClick={cargarMas} loading={loadingMore}>
                Cargar más productos
              </Button>
            </div>
          )}
        </>
      )}
      {/* Modal de detalle */}
      {modalProducto && (() => {
        const mp = modalProducto
        const est = estimar(mp)
        const usaApp = mp.precioAppUsd != null && mp.precioAppUsd < (mp.precioUsd ?? Infinity)
        const mkey = mp.url ?? mp.nombre
        const isAdded = added.has(mkey)
        const imagenes = [
          mp.imagen,
          ...(detalle?.imagenesExtras.filter((u) => u !== mp.imagen) ?? []),
        ].filter(Boolean) as string[]
        const clampedIdx = Math.min(imgIdx, Math.max(0, imagenes.length - 1))

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => { setModalProducto(null); setDetalle(null) }}
          >
            <div
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-white z-10 border-b border-gray-100">
                <span className="text-xs text-indigo-500 font-semibold uppercase tracking-wide truncate pr-2">
                  {mp.categoria ?? 'AliExpress'}
                </span>
                <button
                  onClick={() => { setModalProducto(null); setDetalle(null) }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Galería */}
              <div className="relative bg-gray-50" style={{ aspectRatio: '4/3' }}>
                {imagenes.length > 0 ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagenes[clampedIdx]}
                      alt={mp.nombre}
                      className="w-full h-full object-contain"
                    />
                    {imagenes.length > 1 && (
                      <>
                        <button
                          onClick={() => setImgIdx((i) => (i - 1 + imagenes.length) % imagenes.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 transition-colors"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => setImgIdx((i) => (i + 1) % imagenes.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 transition-colors"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                          {imagenes.map((_, ii) => (
                            <button
                              key={ii}
                              onClick={() => setImgIdx(ii)}
                              className={`h-1.5 rounded-full transition-all ${ii === clampedIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {loadingDetalle && (
                      <div className="absolute top-2 right-2 bg-black/30 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                        cargando…
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Radar size={48} className="text-indigo-100" />
                  </div>
                )}
              </div>

              {/* Contenido */}
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-gray-900 leading-snug">
                  {mp.nombre}
                </h2>

                {/* Precios */}
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-gray-900">
                    ${est ? est.precio.toFixed(2) : '—'}
                  </span>
                  <span className="text-sm text-gray-400 mb-0.5">USD</span>
                  {usaApp && (
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 mb-0.5">
                      precio app
                    </span>
                  )}
                  {mp.precioOriginalUsd && mp.descuentoPct ? (
                    <>
                      <span className="text-sm text-gray-400 line-through mb-0.5">
                        ${mp.precioOriginalUsd.toFixed(2)}
                      </span>
                      <span className="text-sm font-bold text-rose-500 mb-0.5">
                        -{mp.descuentoPct}%
                      </span>
                    </>
                  ) : null}
                </div>

                {/* Caja de ganancia */}
                {est && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Costo en MX ({markup}×)</span>
                      <span className="font-medium text-gray-700">${fmtMoney(est.costo)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Precio de venta sugerido</span>
                      <span className="font-semibold text-gray-900">≈ ${fmtMoney(est.sell)}</span>
                    </div>
                    {est.comisionMxn > 0 && (
                      <div className="flex items-center justify-between text-xs text-indigo-600">
                        <span>+ comisión afiliado ({mp.comisionPct}%)</span>
                        <span>≈ +${fmtMoney(est.comisionMxn)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm font-bold text-emerald-800 border-t border-emerald-100 pt-1.5 mt-0.5">
                      <span>Ganancia estimada / pieza</span>
                      <span>≈ ${fmtMoney(est.ganancia)}</span>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  {mp.ordenes != null && <span>📦 {fmt(mp.ordenes)} vendidos</span>}
                  {mp.rating != null && <span>★ {mp.rating.toFixed(0)}% positivos</span>}
                  {mp.comisionPct != null && mp.comisionPct > 0 && (
                    <span className="text-indigo-600 font-medium">
                      💸 {mp.comisionPct}% comisión
                    </span>
                  )}
                </div>

                {/* Especificaciones */}
                {detalle?.atributos && detalle.atributos.length > 0 && (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Especificaciones
                    </div>
                    <div className="divide-y divide-gray-100">
                      {detalle.atributos.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                          <span className="text-gray-500 min-w-[110px] shrink-0">{a.nombre}</span>
                          <span className="text-gray-800 font-medium">{a.valor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pb-2">
                  {isAdded ? (
                    <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-xl py-2.5">
                      <Check size={16} /> Agregado al Radar
                    </span>
                  ) : (
                    <Button
                      size="md"
                      onClick={() => { agregar(mp); setModalProducto(null); setDetalle(null) }}
                      loading={adding === mkey}
                      className="flex-1"
                    >
                      <Plus size={15} /> Evaluar producto
                    </Button>
                  )}
                  {mp.url && (
                    <a
                      href={mp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink size={15} /> AliExpress
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
