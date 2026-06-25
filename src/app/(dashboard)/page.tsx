'use client'
import { useEffect, useState, useCallback } from 'react'
import { OpportunidadesTable } from '@/components/dashboard/OpportunidadesTable'
import { Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { RefreshCw } from 'lucide-react'

type Row = Parameters<typeof OpportunidadesTable>[0]['rows'][number]

const NICHOS = ['', 'belleza', 'hogar', 'tech', 'mascotas', 'fitness', 'moda', 'cocina', 'otro']
const ESTADOS = ['', 'nuevo', 'investigando', 'comprado', 'descartado']

export default function DashboardPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [nicho, setNicho] = useState('')
  const [estado, setEstado] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (nicho) params.set('nicho', nicho)
    if (estado) params.set('estado', estado)

    const res = await fetch(`/api/opportunities?${params}`)
    const data = await res.json()
    setRows(data)
    setLoading(false)
  }, [nicho, estado])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = async (id: string) => {
    await fetch(`/api/refresh/${id}`, { method: 'POST' })
    await fetchData()
  }

  const handleRefreshAll = async () => {
    setRefreshingAll(true)
    await Promise.all(rows.map((r) => fetch(`/api/refresh/${r.id}`, { method: 'POST' })))
    await fetchData()
    setRefreshingAll(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oportunidades</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ordenadas por score de oportunidad</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
            options={NICHOS.map((n) => ({ value: n, label: n || 'Todos los nichos' }))}
            className="w-44"
          />
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            options={ESTADOS.map((s) => ({ value: s, label: s || 'Todos los estados' }))}
            className="w-44"
          />
          {rows.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleRefreshAll} loading={refreshingAll} title="Refrescar momentum de todos los productos">
              <RefreshCw size={14} />
              {refreshingAll ? 'Refrescando…' : 'Refrescar todo'}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : (
        <OpportunidadesTable rows={rows} onRefresh={handleRefresh} />
      )}
    </div>
  )
}
