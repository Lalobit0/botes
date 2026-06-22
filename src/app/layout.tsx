import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Radar MX — Detector de oportunidades',
  description: 'Detecta productos con momentum en el extranjero antes de que lleguen a México.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} min-h-full`}>{children}</body>
    </html>
  )
}
