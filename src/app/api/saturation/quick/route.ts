import { NextResponse } from 'next/server'

// Consulta rápida de saturación en ML MX — solo devuelve el total de publicaciones.
// Sin writes a DB, pensada para uso desde la página Descubrir.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ ok: false, total: null }, { status: 400 })

  try {
    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLM/search?q=${encodeURIComponent(q)}&limit=1`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!res.ok) return NextResponse.json({ ok: false, total: null })
    const data = await res.json()
    return NextResponse.json({ ok: true, total: (data.paging?.total as number) ?? 0 })
  } catch {
    return NextResponse.json({ ok: false, total: null })
  }
}
