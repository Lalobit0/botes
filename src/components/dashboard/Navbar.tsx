'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, Calendar, PlusCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/captura', label: 'Captura rápida', icon: PlusCircle },
  { href: '/digest', label: 'Digest semanal', icon: Calendar },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Zap size={20} className="text-indigo-600" />
        <span className="font-bold text-gray-900 text-lg ml-1">Radar MX</span>
      </div>
      <div className="flex items-center gap-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === href
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors ml-2"
        >
          <LogOut size={15} />
          Salir
        </button>
      </div>
    </nav>
  )
}
