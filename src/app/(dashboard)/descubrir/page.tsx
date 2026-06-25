'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Search, Plus, ExternalLink, Check, Radar } from 'lucide-react'

interface Producto {
  nombre: string
  keyword: string
  precioUsd: number | null
  precioOriginalUsd: number | null
  descuentoPct: number | null
  imagen: string | null
  url: string | null
  ordenes: number | null
  rating: number | null
  categoria: string | null
}

interface DiscoverResponse {
  sources: { aliexpress: boolean; mercadolibre_mx: boolean }
  q: string
  nicho: string
  sort: string
  country: string
  page: number
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

const SORTS = [
  { value: 'LAST_VOLUME_DESC', label: 'Más vendidos' },
  { value: 'SALE_PRICE_ASC', label: 'Precio: menor a mayor' },
  { value: 'SALE_PRICE_DESC', label: 'Precio: mayor a menor' },
]

const PAISES = [
  { value: 'MX', label: '🇲🇽 Envío a México' },
  { value: '', label: '🌎 Global' },
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'ES', label: '🇪🇸 España' },
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'CO', label: '🇨🇴 Colombia' },
  { value: 'CL', label: '🇨🇱 Chile' },
]

const PAGE_SIZE = 24
const fmt = (n: number) => n.toLocaleString('es-MX')

export default function DescubrirPage() {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [nicho, setNicho] = useState('')
  const [sort, setSort] = useState('LAST_VOLUME_DESC')
  const [country, setCountry] = useState('MX')
  const [page, setPage] = useState(1)

  const [productos, setProductos] = useState<Producto[]>([])
  const [tendencias, setTendencias] = useState<string[]>([])
  const [sources, setSources] = useState({ aliexpress: false, mercadolibre_mx: false })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  const fetchProductos = useCallback(
    async (o: {
      q: string
      nicho: string
      sort: string
      country: string
      page: number
      chips?: boolean
      append?: boolean
    }) => {
      if (o.append) setLoadingMore(true)
      else setLoading(true)

      const params = new URLSearchParams()
      if (o.q) params.set('q', o.q)
      if (o.nicho) params.set('nicho', o.nicho)
      params.set('sort', o.sort)
      if (o.country) params.set('country', o.country)
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

  // Carga inicial (diferida para no setear estado de forma síncrona en el efecto).
  useEffect(() => {
    const id = setTimeout(() => {
      fetchProductos({ q: '', nicho: '', sort: 'LAST_VOLUME_DESC', country: 'MX', page: 1, chips: true })
    }, 0)
    return () => clearTimeout(id)
  }, [fetchProductos])

  const buscar = (texto: string) => {
    setQ(texto)
    setNicho('')
    setPage(1)
    fetchProductos({ q: texto, nicho: '', sort, country, page: 1 })
  }

  const elegirNicho = (n: string) => {
    setNicho(n)
    setQ('')
    setText('')
    setPage(1)
    fetchProductos({ q: '', nicho: n, sort, country, page: 1 })
  }

  const cambiarSort = (s: string) => {
    setSort(s)
    setPage(1)
    fetchProductos({ q, nicho, sort: s, country, page: 1 })
  }

  const cambiarPais = (c: string) => {
    setCountry(c)
    setPage(1)
    fetchProductos({ q, nicho, sort, country: c, page: 1 })
  }

  const cargarMas = () => {
    const next = page + 1
    setPage(next)
    fetchProductos({ q, nicho, sort, country, page: next, append: true })
  }

  const agregar = async (p: Producto) => {
    const key = p.url ?? p.nombre
    setAdding(key)
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
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
    ? `Resultados para “${q}”`
    : nicho
      ? `${NICHOS.find((n) => n.value === nicho)?.label ?? nicho} · más vendidos`
      : 'Productos ganadores · más vendidos'

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
            Encuentra productos ganadores en AliExpress antes de que saturen México. Mira precio de
            compra, ventas y agrégalos para calcular tu margen.
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

        {/* Orden + país */}
        <div className="flex flex-wrap gap-2 mt-3">
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
        </div>
      </div>

      {/* Tendencias de Mercado Libre MX como chips de búsqueda */}
      {tendencias.length > 0 && (
        <div className="mb-5">
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
            {productos.map((p, i) => {
              const key = p.url ?? p.nombre
              const isAdded = added.has(key)
              const ganador = (p.ordenes ?? 0) >= 5000
              return (
                <div
                  key={`${key}-${i}`}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col"
                >
                  <div className="relative aspect-square bg-gray-50 overflow-hidden">
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
                        ${p.precioUsd != null ? p.precioUsd.toFixed(2) : '—'}
                      </span>
                      <span className="text-[11px] text-gray-400 mb-0.5">USD</span>
                      {p.precioOriginalUsd && p.descuentoPct ? (
                        <span className="text-xs text-gray-400 line-through mb-0.5">
                          ${p.precioOriginalUsd.toFixed(2)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {p.ordenes != null && <span>📦 {fmt(p.ordenes)} vendidos</span>}
                      {p.rating != null && <span>★ {p.rating.toFixed(0)}%</span>}
                    </div>

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
    </div>
  )
}
