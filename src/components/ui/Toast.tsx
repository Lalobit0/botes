'use client'
import { useEffect } from 'react'
import { Check, X } from 'lucide-react'

interface Props {
  message: string
  ok?: boolean
  onDone: () => void
}

export function Toast({ message, ok = true, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 ${
        ok ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      {ok ? <Check size={15} /> : <X size={15} />}
      {message}
    </div>
  )
}
