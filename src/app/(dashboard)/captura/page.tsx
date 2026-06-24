'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

const NICHOS = ['belleza', 'hogar', 'tech', 'mascotas', 'fitness', 'moda', 'cocina', 'otro']
const FUENTES: { value: string; label: string }[] = [
  { value: 'tiktok', label: 'TikTok Creative Center' },
  { value: 'amazon_us', label: 'Amazon US Movers & Shakers' },
  { value: 'aliexpress', label: 'AliExpress Hot Products' },
  { value: 'google_trends', label: 'Google Trends' },
]
const TIERS = [
  { value: 'emergente', label: 'Emergente 🔥' },
  { value: 'creciente', label: 'Creciente 📈' },
  { value: 'establecida', label: 'Establecida ✅' },
]

export default function CapturaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSignal, setShowSignal] = useState(true)

  const [product, setProduct] = useState({
    nombre: '', keyword_busqueda: '', nicho: '', categoria: '', notas: '',
  })
  const [precioUsd, setPrecioUsd] = useState('')
  const [linkRef, setLinkRef] = useState('')
  const [signal, setSignal] = useState({
    fuente: 'tiktok', tier: 'emergente', rank: '', valor: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const notasFinal = [product.notas, linkRef && `Ref: ${linkRef}`]
        .filter(Boolean)
        .join(' · ')

      const prodRes = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: product.nombre,
          keyword_busqueda: product.keyword_busqueda,
          nicho: product.nicho || null,
          categoria: product.categoria || null,
          notas: notasFinal || null,
        }),
      })

      if (!prodRes.ok) {
        const err = await prodRes.json()
        throw new Error(err.error)
      }

      const prod = await prodRes.json()

      // Guardar señal si hay fuente seleccionada
      if (signal.fuente) {
        await fetch('/api/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: prod.id,
            fuente: signal.fuente,
            tipo_metrica: signal.fuente === 'tiktok' ? 'tier' : signal.rank ? 'rank' : 'growth_pct',
            tier: signal.fuente === 'tiktok' ? signal.tier : null,
            rank: signal.rank ? parseInt(signal.rank) : null,
            valor: signal.valor ? parseFloat(signal.valor) : null,
          }),
        })
      }

      // Si capturó precio de origen, pre-llena la calculadora de margen
      if (precioUsd) {
        await fetch(`/api/margin/${prod.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ precio_origen_usd: parseFloat(precioUsd) }),
        })
      }

      // Calcula el momentum automático (Google Trends) en segundo plano
      await fetch(`/api/refresh/${prod.id}`, { method: 'POST' })

      router.push(`/producto/${prod.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agregar producto específico</h1>
        <p className="text-sm text-gray-500 mt-1">
          Un producto concreto que ya viste (TikTok, AliExpress, una tienda gringa), no una categoría.
          Entre más específico, mejor evalúa el radar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre del producto (específico)"
            required
            value={product.nombre}
            onChange={(e) => setProduct({ ...product, nombre: e.target.value })}
            placeholder="ej. Mochila antirrobo USB impermeable hombre"
          />
          <Input
            label="Keyword exacta para buscar en ML"
            required
            value={product.keyword_busqueda}
            onChange={(e) => setProduct({ ...product, keyword_busqueda: e.target.value })}
            placeholder="ej. mochila antirrobo usb impermeable"
          />
          <p className="-mt-2 text-xs text-gray-400">
            Tip: usa el modelo/atributos concretos (material, función, marca) — no &ldquo;mochila&rdquo; a secas.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio de origen (USD)"
              type="number"
              min="0"
              step="0.01"
              value={precioUsd}
              onChange={(e) => setPrecioUsd(e.target.value)}
              placeholder="ej. 8.50"
              leading="$"
            />
            <Select
              label="Nicho"
              value={product.nicho}
              onChange={(e) => setProduct({ ...product, nicho: e.target.value })}
              options={[{ value: '', label: 'Sin nicho' }, ...NICHOS.map((n) => ({ value: n, label: n }))]}
            />
          </div>
          <Input
            label="Link de referencia (AliExpress / TikTok / Amazon)"
            value={linkRef}
            onChange={(e) => setLinkRef(e.target.value)}
            placeholder="https://..."
          />
          <Input
            label="Notas"
            value={product.notas}
            onChange={(e) => setProduct({ ...product, notas: e.target.value })}
            placeholder="Por qué te llamó la atención, etc."
          />
        </div>

        {/* Señal de momentum */}
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowSignal(!showSignal)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
          >
            Señal de momentum (opcional)
            {showSignal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showSignal && (
            <div className="mt-4 flex flex-col gap-4">
              <Select
                label="Fuente"
                value={signal.fuente}
                onChange={(e) => setSignal({ ...signal, fuente: e.target.value })}
                options={FUENTES}
              />
              {signal.fuente === 'tiktok' && (
                <Select
                  label="Tier (TikTok Creative Center)"
                  value={signal.tier}
                  onChange={(e) => setSignal({ ...signal, tier: e.target.value })}
                  options={TIERS}
                />
              )}
              {signal.fuente === 'amazon_us' && (
                <Input
                  label="Posición en Movers & Shakers (rank)"
                  type="number"
                  min="1"
                  value={signal.rank}
                  onChange={(e) => setSignal({ ...signal, rank: e.target.value })}
                  placeholder="ej. 5"
                />
              )}
              {(signal.fuente === 'aliexpress' || signal.fuente === 'google_trends') && (
                <Input
                  label={signal.fuente === 'aliexpress' ? 'Crecimiento de órdenes (%)' : 'Pendiente de búsqueda (0-100)'}
                  type="number"
                  min="0"
                  value={signal.valor}
                  onChange={(e) => setSignal({ ...signal, valor: e.target.value })}
                  placeholder={signal.fuente === 'aliexpress' ? 'ej. 250' : 'ej. 78'}
                />
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          <Plus size={16} />
          Agregar y evaluar
        </Button>
      </form>
    </div>
  )
}
