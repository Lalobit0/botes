const ML_BASE = 'https://api.mercadolibre.com'

// Nota: la saturación (publicaciones/precios en MX) ya no se obtiene aquí.
// ML devuelve 403 en su API de búsqueda y bloquea el scraping con anti-bot,
// así que ese dato se captura a mano (ver /api/saturation). Lo que sí sigue
// funcionando con token de app es /trends/MLM (tendencias locales).

export async function obtenerTendenciasML(accessToken: string): Promise<string[]> {
  const url = `${ML_BASE}/trends/MLM`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`ML trends error: ${res.status}`)
  const json = await res.json()
  return (json as Array<{ keyword: string }>).map((t) => t.keyword.toLowerCase())
}

export async function obtenerAccessToken(): Promise<string> {
  const res = await fetch(`${ML_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`ML auth error: ${res.status}`)
  const json = await res.json()
  return json.access_token
}
