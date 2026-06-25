import type { TrendSignal, MxSaturation, MarginInputs } from './supabase/types'

// Weights per source
const PESOS_FUENTE = {
  tiktok: 0.4,
  aliexpress: 0.3,
  amazon_us: 0.2,
  google_trends: 0.1,
}

const TIER_SCORES: Record<string, number> = {
  emergente: 100,
  creciente: 70,
  establecida: 40,
}

function calcularMomentumFuente(signals: TrendSignal[], fuente: string): number | null {
  const relevantes = signals.filter((s) => s.fuente === fuente)
  if (relevantes.length === 0) return null

  const scores: number[] = relevantes.map((s) => {
    if (fuente === 'tiktok') {
      if (s.tier) return TIER_SCORES[s.tier] ?? 0
      return 0
    }
    if (fuente === 'aliexpress') {
      // growth_pct normalizado 0-100 (asumimos max 500% como techo)
      const pct = s.valor ?? 0
      return Math.min(100, (pct / 500) * 100)
    }
    if (fuente === 'amazon_us') {
      // search_slope = log10-normalised result count (0-100), stored in valor
      if (s.tipo_metrica === 'search_slope') {
        return Math.min(100, Math.max(0, s.valor ?? 0))
      }
      // rank signals from "Captura rápida" use Movers&Shakers position (1-100)
      if (s.rank != null && s.tipo_metrica === 'rank') {
        return Math.max(0, 100 - s.rank + 1)
      }
      if (s.tipo_metrica === 'growth_pct') {
        return Math.min(100, Math.max(0, s.valor ?? 0))
      }
      return 0
    }
    if (fuente === 'google_trends') {
      // search_slope normalizado. Asumimos valor 0-100 ya normalizado
      return Math.min(100, Math.max(0, s.valor ?? 0))
    }
    return 0
  })

  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export function calcularMomentumScore(signals: TrendSignal[]): number {
  let sumaSignals = 0
  let sumaPesos = 0

  for (const [fuente, peso] of Object.entries(PESOS_FUENTE)) {
    const score = calcularMomentumFuente(signals, fuente)
    if (score !== null) {
      sumaSignals += score * peso
      sumaPesos += peso
    }
  }

  if (sumaPesos === 0) return 0
  return sumaSignals / sumaPesos
}

export function calcularSaturacionScore(sat: MxSaturation | null): number {
  if (!sat) return 0
  const base = Math.min(100, 20 * Math.log10((sat.num_publicaciones ?? 0) + 1))
  const penalizacion = sat.aparece_en_ml_trends ? 30 : 0
  return Math.min(100, base + penalizacion)
}

export interface MargenResult {
  costoLanded: number
  margenMxn: number
  margenPct: number
  valido: boolean
}

export function calcularMargen(inputs: MarginInputs | null): MargenResult {
  if (
    !inputs ||
    inputs.precio_origen_usd == null ||
    inputs.precio_venta_estimado_mxn == null
  ) {
    return { costoLanded: 0, margenMxn: 0, margenPct: 0, valido: false }
  }

  const costoBase =
    inputs.precio_origen_usd * (inputs.tipo_cambio ?? 18) +
    (inputs.costo_envio_importacion_mxn ?? 0)

  const costoLanded =
    costoBase * (1 + (inputs.arancel_pct ?? 0) / 100) * (1 + (inputs.iva_pct ?? 16) / 100)

  const margenMxn = inputs.precio_venta_estimado_mxn - costoLanded
  const margenPct =
    inputs.precio_venta_estimado_mxn > 0
      ? (margenMxn / inputs.precio_venta_estimado_mxn) * 100
      : 0

  return { costoLanded, margenMxn, margenPct, valido: true }
}

export interface OportunidadResult {
  momentumScore: number
  saturacionScore: number
  margenMxn: number
  margenPct: number
  opportunityScore: number
  margenSinValidar: boolean
}

export function calcularOportunidad(
  signals: TrendSignal[],
  saturation: MxSaturation | null,
  marginInputs: MarginInputs | null
): OportunidadResult {
  const momentumScore = calcularMomentumScore(signals)
  const saturacionScore = calcularSaturacionScore(saturation)
  const { margenMxn, margenPct, valido } = calcularMargen(marginInputs)

  const base = momentumScore - 0.7 * saturacionScore

  let opportunityScore: number
  if (!valido) {
    // No hay datos de margen: calculamos igual pero marcamos como sin validar
    opportunityScore = Math.max(0, base)
  } else {
    opportunityScore = margenMxn > 0 ? Math.max(0, base) : 0
  }

  return {
    momentumScore,
    saturacionScore,
    margenMxn,
    margenPct,
    opportunityScore,
    margenSinValidar: !valido,
  }
}
