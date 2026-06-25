'use client'
import Link from 'next/link'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ScoreBadge, EstadoBadge } from '@/components/ui/Badge'

interface Fila {
  id: string
  nombre: string
  nicho: string | null
  estado: string
  imagen_url: string | null
  radar_opportunities: {
    momentum_score: number | null
    saturacion_score: number | null
    margen_pct: number | null
    opportunity_score: number | null
  } | null
}

interface Props {
  rows: Fila[]
  onRefresh: (id: string) => Promise<void>
}

export function OpportunidadesTable({ rows, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState<string | null>(null)

  const handleRefresh = async (id: string) => {
    setRefreshing(id)
    try { await onRefresh(id) } finally { setRefreshing(null) }
  }

  const emptyState = (
    <p className="py-10 text-center text-gray-400 text-sm px-4">
      Sin productos. Agrega uno desde &ldquo;Captura rápida&rdquo;.
    </p>
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* ── Mobile: card list ── */}
      <ul className="sm:hidden divide-y divide-gray-100">
        {rows.length === 0 ? emptyState : rows.map((row) => {
          const opp = row.radar_opportunities
          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              {row.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.imagen_url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-50"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/producto/${row.id}`}
                    className="font-medium text-indigo-600 text-sm leading-snug line-clamp-2 hover:underline"
                  >
                    {row.nombre}
                  </Link>
                  <EstadoBadge estado={row.estado} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <span className="text-xs text-gray-500">
                    Score{' '}
                    <span className="font-semibold text-gray-800">
                      {opp?.opportunity_score?.toFixed(1) ?? '—'}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500">
                    Momentum{' '}
                    <span className="font-semibold text-gray-800">
                      {opp?.momentum_score?.toFixed(0) ?? '—'}
                    </span>
                  </span>
                  {opp?.margen_pct != null && (
                    <span className={`text-xs font-semibold ${opp.margen_pct > 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {opp.margen_pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRefresh(row.id)}
                disabled={refreshing === row.id}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 shrink-0"
                title="Refrescar señales de momentum"
              >
                {refreshing === row.id
                  ? <Loader2 size={15} className="animate-spin" />
                  : <RefreshCw size={15} />}
              </button>
            </li>
          )
        })}
      </ul>

      {/* ── Desktop: table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-3 w-12" />
              {['Producto', 'Nicho', 'Momentum', 'Saturación', 'Margen %', 'Score', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                  Sin productos. Agrega uno desde &ldquo;Captura rápida&rdquo;.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const opp = row.radar_opportunities
              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3">
                    {row.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-50" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <Link
                      href={`/producto/${row.id}`}
                      className="font-medium text-indigo-600 hover:underline block truncate"
                      title={row.nombre}
                    >
                      {row.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{row.nicho ?? '—'}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={opp?.momentum_score ?? null} label={opp ? `${(opp.momentum_score ?? 0).toFixed(0)}` : '—'} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={opp ? 100 - (opp.saturacion_score ?? 0) : null} label={opp ? `${(opp.saturacion_score ?? 0).toFixed(0)}` : '—'} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {opp?.margen_pct != null ? (
                      <span className={opp.margen_pct > 0 ? 'text-green-700 font-medium' : 'text-red-600'}>
                        {opp.margen_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">sin datos</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={opp?.opportunity_score ?? null} />
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={row.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRefresh(row.id)}
                      disabled={refreshing === row.id}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                      title="Refrescar señales de momentum"
                    >
                      {refreshing === row.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <RefreshCw size={15} />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
