'use client'
import { useEffect, useState } from 'react'
import { ScoreBadge, EstadoBadge } from '@/components/ui/Badge'
import Link from 'next/link'
import { Calendar } from 'lucide-react'

interface OppRow {
  id: string
  nombre: string
  nicho: string | null
  estado: string
  created_at: string
  radar_opportunities: {
    opportunity_score: number | null
    momentum_score: number | null
    margen_pct: number | null
    actualizado_at: string
  } | null
}

export default function DigestPage() {
  const [rows, setRows] = useState<OppRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/opportunities')
      .then((r) => r.json())
      .then((data: OppRow[]) => {
        // Filtrar los de la última semana y score > 0
        const hace7dias = new Date()
        hace7dias.setDate(hace7dias.getDate() - 7)
        const recientes = data.filter((r) => {
          const creado = new Date(r.created_at)
          return creado >= hace7dias && (r.radar_opportunities?.opportunity_score ?? 0) > 0
        })
        setRows(recientes)
        setLoading(false)
      })
  }, [])

  const semana = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="bg-indigo-100 p-2 rounded-xl">
          <Calendar size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digest semanal</h1>
          <p className="text-sm text-gray-500 mt-0.5">Productos nuevos de los últimos 7 días · {semana}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-gray-400 text-sm">No hay productos nuevos con score esta semana.</p>
          <p className="text-gray-400 text-xs mt-1">Agrega productos en &ldquo;Captura rápida&rdquo; cada lunes.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/producto/${row.id}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{row.nombre}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{row.nicho ?? 'Sin nicho'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <EstadoBadge estado={row.estado} />
                  <ScoreBadge score={row.radar_opportunities?.opportunity_score ?? null} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400">Momentum</p>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {row.radar_opportunities?.momentum_score?.toFixed(0) ?? '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400">Margen %</p>
                  <p className={`font-semibold mt-0.5 ${(row.radar_opportunities?.margen_pct ?? 0) > 0 ? 'text-green-700' : 'text-gray-800'}`}>
                    {row.radar_opportunities?.margen_pct != null ? `${row.radar_opportunities.margen_pct.toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400">Score</p>
                  <p className="font-semibold text-indigo-700 mt-0.5">
                    {row.radar_opportunities?.opportunity_score?.toFixed(1) ?? '—'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
