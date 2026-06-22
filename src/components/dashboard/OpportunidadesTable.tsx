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
  opportunities: {
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

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr className="bg-gray-50">
            {['Producto', 'Nicho', 'Momentum', 'Saturación', 'Margen %', 'Score', 'Estado', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                Sin productos. Agrega uno desde &ldquo;Captura rápida&rdquo;.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const opp = row.opportunities
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/producto/${row.id}`} className="font-medium text-indigo-600 hover:underline">
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
                    title="Refrescar datos de ML"
                  >
                    {refreshing === row.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
