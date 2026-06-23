'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Radar, Plus, ExternalLink, AlertCircle, Check } from 'lucide-react'

interface Sugerencia {
  nombre: string
  keyword: string
  fuente: 'aliexpress' | 'mercadolibre_mx'
  precioUsd?: number | null
  imagen?: string | null
  url?: string | null
  ordenes?: number | null
  nota?: string
}

interface DiscoverResponse {
  sources: { aliexpress: boolean; mercadolibre_mx: boolean }
  sugerencias: Sugerencia[]
}

const FUENTE_LABEL: Record<string, string> = {
  aliexpress: 'AliExpress',
  mercadolibre_mx: 'Mercado Libre MX',
}

export default function DescubrirPage() {
  const router = useRouter()
  const [data, setData] = useState<DiscoverResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/discover')
      .then((r) => r.json())
      .then((d: DiscoverResponse) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAdd = async (s: Sugerencia) => {
    setAdding(s.keyword + s.fuente)
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    if (res.ok) {
      const prod = await res.json()
      setAdded((prev) => new Set(prev).add(s.keyword + s.fuente))
      // Refresca ML + Google Trends en segundo plano
      fetch(`/api/refresh/${prod.id}`, { method: 'POST' })
    }
    setAdding(null)
  }

  const noSources = data && !data.sources.aliexpress && !data.sources.mercadolibre_mx

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="bg-indigo-100 p-2 rounded-xl">
          <Radar size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Descubrir</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Productos sugeridos automáticamente desde fuentes externas.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Buscando oportunidades...</div>
      ) : noSources ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-2">Aún no hay fuentes automáticas configuradas</p>
              <p className="mb-3">Para que el radar sugiera productos solo, agrega credenciales:</p>
              <ul className="space-y-2 list-disc list-inside text-amber-800">
                <li>
                  <strong>AliExpress</strong> (descubrimiento de productos ganadores): registra una
                  app en{' '}
                  <a
                    href="https://portals.aliexpress.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    portals.aliexpress.com
                  </a>{' '}
                  y define <code className="bg-amber-100 px-1 rounded">ALIEXPRESS_APP_KEY</code> y{' '}
                  <code className="bg-amber-100 px-1 rounded">ALIEXPRESS_APP_SECRET</code>.
                </li>
                <li>
                  <strong>Mercado Libre MX</strong> (tendencias locales): registra una app en{' '}
                  <a
                    href="https://developers.mercadolibre.com.mx"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    developers.mercadolibre.com.mx
                  </a>{' '}
                  y define <code className="bg-amber-100 px-1 rounded">ML_CLIENT_ID</code> y{' '}
                  <code className="bg-amber-100 px-1 rounded">ML_CLIENT_SECRET</code>.
                </li>
              </ul>
              <p className="mt-3 text-amber-800">
                Mientras tanto, el <strong>momentum por Google Trends ya funciona</strong>: agrega un
                producto en &ldquo;Captura rápida&rdquo; y al refrescar se calcula solo.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4 text-xs">
            <span
              className={`px-2.5 py-1 rounded-full border ${
                data?.sources.aliexpress
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              AliExpress {data?.sources.aliexpress ? '●' : '○'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full border ${
                data?.sources.mercadolibre_mx
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              Mercado Libre MX {data?.sources.mercadolibre_mx ? '●' : '○'}
            </span>
          </div>

          {data?.sugerencias.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <p className="text-gray-400 text-sm">Sin sugerencias por ahora. Vuelve a intentar.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {data?.sugerencias.map((s, i) => {
                const key = s.keyword + s.fuente
                const isAdded = added.has(key)
                return (
                  <div
                    key={`${key}-${i}`}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-3"
                  >
                    {s.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.imagen}
                        alt={s.nombre}
                        className="w-16 h-16 rounded-lg object-cover shrink-0 bg-gray-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Radar size={20} className="text-indigo-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                        {FUENTE_LABEL[s.fuente]}
                      </span>
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2 leading-snug">
                        {s.nombre}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {s.precioUsd != null && <span>${s.precioUsd} USD</span>}
                        {s.ordenes != null && <span>· {s.ordenes} órdenes</span>}
                        {s.nota && <span className="text-amber-600">{s.nota}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {isAdded ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Check size={13} /> Agregado
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAdd(s)}
                            loading={adding === key}
                          >
                            <Plus size={13} /> Agregar
                          </Button>
                        )}
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-400 hover:text-indigo-600"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
