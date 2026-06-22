'use client'

interface BadgeProps {
  score: number | null
  label?: string
  className?: string
}

export function ScoreBadge({ score, label, className = '' }: BadgeProps) {
  const s = score ?? 0
  const color =
    s >= 60
      ? 'bg-green-100 text-green-800 border-green-200'
      : s >= 30
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color} ${className}`}
    >
      {label ?? s.toFixed(0)}
    </span>
  )
}

interface EstadoBadgeProps {
  estado: string
}

const estadoColors: Record<string, string> = {
  nuevo: 'bg-blue-100 text-blue-800 border-blue-200',
  investigando: 'bg-purple-100 text-purple-800 border-purple-200',
  comprado: 'bg-green-100 text-green-800 border-green-200',
  descartado: 'bg-gray-100 text-gray-600 border-gray-200',
}

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const color = estadoColors[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {estado}
    </span>
  )
}
