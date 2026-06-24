'use client'
import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { ScoreBadge, EstadoBadge } from '@/components/ui/Badge'
import { RefreshCw, ChevronLeft, Save, Trash2, Search } from 'lucide-react'
import type { ProductConDetalle, MarginInputs } from '@/lib/supabase/types'
import Link from 'next/link'

const ESTADOS = ['nuevo', 'investigando', 'comprado', 'descartado']

function fmt(n: number | null | undefined, decimals = 0, prefix = '') {
  if (n == null) return '—'
  return `${prefix}${n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export default function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<ProductConDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [margin, setMargin] = useState<Partial<MarginInputs>>({
    tipo_cambio: 18,
    arancel_pct: 0,
    iva_pct: 16,
    costo_envio_importacion_mxn: 0,
  })
  const [estado, setEstado] = useState('nuevo')
  const [notas, setNotas] = useState('')
  const [savingSat, setSavingSat] = useState(false)
  const [sat, setSat] = useState<{
    num_publicaciones: string
    precio_min: string
    precio_max: string
  }>({ num_publicaciones: '', precio_min: '', precio_max: '' })

  const fetchProduct = useCallback(async (): Promise<ProductConDetalle | null> => {
    const res = await fetch(`/api/products/${id}`)
    if (!res.ok) { router.push('/'); return null }
    const data: ProductConDetalle = await res.json()
    setProduct(data)
    setEstado(data.estado)
    setNotas(data.notas ?? '')
    if (data.radar_margin_inputs) {
      setMargin(data.radar_margin_inputs)
    }
    const ultima = data.radar_mx_saturation?.[data.radar_mx_saturation.length - 1]
    if (ultima) {
      setSat({
        num_publicaciones: ultima.num_publicaciones?.toString() ?? '',
        precio_min: ultima.precio_min?.toString() ?? '',
        precio_max: ultima.precio_max?.toString() ?? '',
      })
    }
    setLoading(false)
    return data
  }, [id, router])

  useEffect(() => {
    // Carga inicial de datos (patrón estándar de data-fetching en effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProduct()
  }, [fetchProduct])

  const handleSaveSaturation = async () => {
    setSavingSat(true)
    await fetch(`/api/saturation/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        num_publicaciones: sat.num_publicaciones === '' ? null : Number(sat.num_publicaciones),
        precio_min: sat.precio_min === '' ? null : Number(sat.precio_min),
        precio_max: sat.precio_max === '' ? null : Number(sat.precio_max),
      }),
    })
    await fetchProduct()
    setSavingSat(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch(`/api/refresh/${id}`, { method: 'POST' })
    await fetchProduct()
    setRefreshing(false)
  }

  const handleSaveMargin = async () => {
    setSaving(true)
    await fetch(`/api/margin/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(margin),
    })
    await fetchProduct()
    setSaving(false)
  }

  const handleSaveEstado = async (newEstado: string) => {
    setEstado(newEstado)
    await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: newEstado, notas }),
    })
    await fetchProduct()
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este producto?')) return
    setDeleting(true)
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando...</div>
  if (!product) return null

  const opp = product.radar_opportunities
  const latestSat = product.radar_mx_saturation?.[product.radar_mx_saturation.length - 1]

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{product.nombre}</h1>
          <p className="text-sm text-gray-500">Keyword: <code className="bg-gray-100 px-1 rounded">{product.keyword_busqueda}</code></p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoBadge estado={product.estado} />
          <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw size={14} />
            Refrescar momentum
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Momentum', value: opp?.momentum_score, color: 'indigo' },
          { label: 'Saturación', value: opp?.saturacion_score, color: 'orange' },
          { label: 'Margen %', value: opp?.margen_pct, suffix: '%', color: 'green' },
          { label: 'Score oportunidad', value: opp?.opportunity_score, color: 'purple' },
        ].map(({ label, value, suffix, color: _ }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
            <div className="mt-2 flex items-end gap-1">
              {value != null ? (
                <>
                  <span className="text-2xl font-bold text-gray-900">{value.toFixed(1)}</span>
                  {suffix && <span className="text-gray-500 text-sm mb-0.5">{suffix}</span>}
                </>
              ) : (
                <span className="text-gray-400 text-lg">—</span>
              )}
            </div>
            {opp?.opportunity_score != null && label === 'Score oportunidad' && (
              <ScoreBadge score={opp.opportunity_score} className="mt-2" />
            )}
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Saturación ML — captura manual */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900">Saturación en Mercado Libre MX</h2>
            {latestSat?.aparece_en_ml_trends && (
              <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                ⚠️ En tendencias MX
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">
            ML bloquea la lectura automática. Abre la búsqueda, mira cuántos resultados hay y los
            precios, y captúralos aquí.
          </p>

          <a
            href={`https://listado.mercadolibre.com.mx/${encodeURIComponent(
              product.keyword_busqueda.trim().toLowerCase().replace(/\s+/g, '-')
            ).replace(/%2D/g, '-')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 mb-4"
          >
            <Search size={14} />
            Buscar &ldquo;{product.keyword_busqueda}&rdquo; en Mercado Libre
          </a>

          <div className="flex flex-col gap-3">
            <Input
              label="Publicaciones (resultados)"
              type="number"
              min="0"
              placeholder="ej. 1240"
              value={sat.num_publicaciones}
              onChange={(e) => setSat({ ...sat, num_publicaciones: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Precio más bajo"
                type="number"
                min="0"
                placeholder="ej. 180"
                value={sat.precio_min}
                onChange={(e) => setSat({ ...sat, precio_min: e.target.value })}
                leading="$"
              />
              <Input
                label="Precio más alto"
                type="number"
                min="0"
                placeholder="ej. 950"
                value={sat.precio_max}
                onChange={(e) => setSat({ ...sat, precio_max: e.target.value })}
                leading="$"
              />
            </div>
            <Button onClick={handleSaveSaturation} loading={savingSat} className="w-full mt-1">
              <Save size={14} />
              Guardar saturación
            </Button>
            {latestSat && (
              <p className="text-xs text-gray-400 text-center">
                Última captura: {fmt(latestSat.num_publicaciones)} publicaciones ·{' '}
                {new Date(latestSat.capturado_at).toLocaleDateString('es-MX')}
              </p>
            )}
          </div>
        </div>

        {/* Calculadora de margen */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Calculadora de margen</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Precio origen USD"
              type="number"
              min="0"
              step="0.01"
              value={margin.precio_origen_usd ?? ''}
              onChange={(e) => setMargin({ ...margin, precio_origen_usd: parseFloat(e.target.value) || null })}
              leading="$"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Tipo de cambio"
                type="number"
                min="1"
                value={margin.tipo_cambio ?? 18}
                onChange={(e) => setMargin({ ...margin, tipo_cambio: parseFloat(e.target.value) })}
              />
              <Input
                label="Envío + importación MXN"
                type="number"
                min="0"
                value={margin.costo_envio_importacion_mxn ?? 0}
                onChange={(e) => setMargin({ ...margin, costo_envio_importacion_mxn: parseFloat(e.target.value) })}
                leading="$"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Arancel %"
                type="number"
                min="0"
                max="100"
                value={margin.arancel_pct ?? 0}
                onChange={(e) => setMargin({ ...margin, arancel_pct: parseFloat(e.target.value) })}
              />
              <Input
                label="IVA %"
                type="number"
                min="0"
                value={margin.iva_pct ?? 16}
                onChange={(e) => setMargin({ ...margin, iva_pct: parseFloat(e.target.value) })}
              />
            </div>
            <Input
              label="Precio de venta estimado MXN"
              type="number"
              min="0"
              value={margin.precio_venta_estimado_mxn ?? ''}
              onChange={(e) => setMargin({ ...margin, precio_venta_estimado_mxn: parseFloat(e.target.value) || null })}
              leading="$"
            />
            <Button onClick={handleSaveMargin} loading={saving} className="w-full mt-1">
              <Save size={14} />
              Guardar y recalcular
            </Button>
          </div>
        </div>
      </div>

      {/* Estado y notas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Estado y notas</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {ESTADOS.map((s) => (
            <button
              key={s}
              onClick={() => handleSaveEstado(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                estado === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={async () => {
            await fetch(`/api/products/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notas }),
            })
          }}
          rows={3}
          placeholder="Notas personales sobre el producto..."
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Señales de momentum */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Señales de momentum capturadas</h2>
        {product.radar_trend_signals?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                  {['Fuente', 'País', 'Métrica', 'Valor', 'Rank', 'Tier', 'Fecha'].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {product.radar_trend_signals.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 font-medium">{s.fuente}</td>
                    <td className="py-2 pr-4 text-gray-500">{s.pais}</td>
                    <td className="py-2 pr-4 text-gray-500">{s.tipo_metrica}</td>
                    <td className="py-2 pr-4">{s.valor ?? '—'}</td>
                    <td className="py-2 pr-4">{s.rank ?? '—'}</td>
                    <td className="py-2 pr-4">{s.tier ?? '—'}</td>
                    <td className="py-2 text-gray-400">{new Date(s.capturado_at).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin señales registradas.</p>
        )}
      </div>
    </div>
  )
}
