import { describe, it, expect } from 'vitest'
import {
  calcularMomentumScore,
  calcularSaturacionScore,
  calcularMargen,
  calcularOportunidad,
} from './scoring'
import type { TrendSignal, MxSaturation, MarginInputs } from './supabase/types'

const baseSignal = (overrides: Partial<TrendSignal>): TrendSignal => ({
  id: 'test',
  product_id: 'p1',
  pais: 'US',
  tipo_metrica: 'tier',
  valor: null,
  rank: null,
  tier: null,
  capturado_at: new Date().toISOString(),
  fuente: 'tiktok',
  ...overrides,
})

describe('calcularMomentumScore', () => {
  it('TikTok emergente = 100 con peso 0.4 → score 100 (solo fuente)', () => {
    const signals = [baseSignal({ fuente: 'tiktok', tier: 'emergente' })]
    expect(calcularMomentumScore(signals)).toBeCloseTo(100)
  })

  it('TikTok creciente = 70', () => {
    const signals = [baseSignal({ fuente: 'tiktok', tier: 'creciente' })]
    expect(calcularMomentumScore(signals)).toBeCloseTo(70)
  })

  it('TikTok establecida = 40', () => {
    const signals = [baseSignal({ fuente: 'tiktok', tier: 'establecida' })]
    expect(calcularMomentumScore(signals)).toBeCloseTo(40)
  })

  it('Amazon rank 1 = 100, rank 50 = 51', () => {
    const r1 = [baseSignal({ fuente: 'amazon_us', rank: 1 })]
    expect(calcularMomentumScore(r1)).toBeCloseTo(100)

    const r50 = [baseSignal({ fuente: 'amazon_us', rank: 50 })]
    expect(calcularMomentumScore(r50)).toBeCloseTo(51)
  })

  it('AliExpress 500% crecimiento = 100, 250% = 50', () => {
    const full = [baseSignal({ fuente: 'aliexpress', valor: 500, tipo_metrica: 'growth_pct' })]
    expect(calcularMomentumScore(full)).toBeCloseTo(100)

    const half = [baseSignal({ fuente: 'aliexpress', valor: 250, tipo_metrica: 'growth_pct' })]
    expect(calcularMomentumScore(half)).toBeCloseTo(50)
  })

  it('Sin señales = 0', () => {
    expect(calcularMomentumScore([])).toBe(0)
  })

  it('Combinación ponderada: tiktok emergente + amazon rank 1', () => {
    const signals = [
      baseSignal({ fuente: 'tiktok', tier: 'emergente' }),   // 100 × 0.4
      baseSignal({ fuente: 'amazon_us', rank: 1 }),           // 100 × 0.2
    ]
    // (100*0.4 + 100*0.2) / (0.4+0.2) = 60/0.6 = 100
    expect(calcularMomentumScore(signals)).toBeCloseTo(100)
  })
})

describe('calcularSaturacionScore', () => {
  it('0 publicaciones = 0', () => {
    const sat: MxSaturation = {
      id: 's1', product_id: 'p1', num_publicaciones: 0,
      precio_min: null, precio_max: null, precio_mediana: null,
      aparece_en_ml_trends: false, capturado_at: new Date().toISOString(),
    }
    expect(calcularSaturacionScore(sat)).toBeCloseTo(0)
  })

  it('10 publicaciones → 20 * log10(11) ≈ 20.83', () => {
    const sat: MxSaturation = {
      id: 's1', product_id: 'p1', num_publicaciones: 10,
      precio_min: null, precio_max: null, precio_mediana: null,
      aparece_en_ml_trends: false, capturado_at: new Date().toISOString(),
    }
    expect(calcularSaturacionScore(sat)).toBeCloseTo(20 * Math.log10(11))
  })

  it('Aparece en ML trends suma +30', () => {
    const sat: MxSaturation = {
      id: 's1', product_id: 'p1', num_publicaciones: 0,
      precio_min: null, precio_max: null, precio_mediana: null,
      aparece_en_ml_trends: true, capturado_at: new Date().toISOString(),
    }
    expect(calcularSaturacionScore(sat)).toBe(30)
  })

  it('No puede exceder 100', () => {
    const sat: MxSaturation = {
      id: 's1', product_id: 'p1', num_publicaciones: 999999,
      precio_min: null, precio_max: null, precio_mediana: null,
      aparece_en_ml_trends: true, capturado_at: new Date().toISOString(),
    }
    expect(calcularSaturacionScore(sat)).toBe(100)
  })

  it('null → 0', () => {
    expect(calcularSaturacionScore(null)).toBe(0)
  })
})

describe('calcularMargen', () => {
  const base: MarginInputs = {
    product_id: 'p1',
    precio_origen_usd: 10,
    tipo_cambio: 18,
    costo_envio_importacion_mxn: 50,
    arancel_pct: 0,
    iva_pct: 16,
    precio_venta_estimado_mxn: 500,
  }

  it('calcula costo landed correctamente', () => {
    const { costoLanded } = calcularMargen(base)
    // (10*18 + 50) * 1.0 * 1.16 = 230 * 1.16 = 266.8
    expect(costoLanded).toBeCloseTo(266.8)
  })

  it('calcula margen MXN y %', () => {
    const { margenMxn, margenPct } = calcularMargen(base)
    expect(margenMxn).toBeCloseTo(500 - 266.8)
    expect(margenPct).toBeCloseTo(((500 - 266.8) / 500) * 100)
  })

  it('con arancel del 10%', () => {
    const { costoLanded } = calcularMargen({ ...base, arancel_pct: 10 })
    // (10*18+50) * 1.10 * 1.16 = 230 * 1.10 * 1.16
    expect(costoLanded).toBeCloseTo(230 * 1.1 * 1.16)
  })

  it('inputs null → valido = false', () => {
    const { valido } = calcularMargen(null)
    expect(valido).toBe(false)
  })
})

describe('calcularOportunidad', () => {
  const goodSignals = [baseSignal({ fuente: 'tiktok', tier: 'emergente' })]
  const lowSat: MxSaturation = {
    id: 's1', product_id: 'p1', num_publicaciones: 5,
    precio_min: null, precio_max: null, precio_mediana: null,
    aparece_en_ml_trends: false, capturado_at: new Date().toISOString(),
  }
  const goodMargin: MarginInputs = {
    product_id: 'p1',
    precio_origen_usd: 5,
    tipo_cambio: 18,
    costo_envio_importacion_mxn: 20,
    arancel_pct: 0,
    iva_pct: 16,
    precio_venta_estimado_mxn: 400,
  }

  it('producto emergente, baja saturación, buen margen → score > 0', () => {
    const result = calcularOportunidad(goodSignals, lowSat, goodMargin)
    expect(result.opportunityScore).toBeGreaterThan(0)
    expect(result.margenSinValidar).toBe(false)
  })

  it('margen negativo → opportunityScore = 0', () => {
    const badMargin: MarginInputs = { ...goodMargin, precio_venta_estimado_mxn: 50 }
    const result = calcularOportunidad(goodSignals, lowSat, badMargin)
    expect(result.opportunityScore).toBe(0)
  })

  it('sin datos de margen → margenSinValidar = true, score > 0', () => {
    const result = calcularOportunidad(goodSignals, lowSat, null)
    expect(result.margenSinValidar).toBe(true)
    expect(result.opportunityScore).toBeGreaterThan(0)
  })

  it('formula: base = momentum - 0.7 * saturacion', () => {
    const result = calcularOportunidad(goodSignals, lowSat, goodMargin)
    const expected = result.momentumScore - 0.7 * result.saturacionScore
    expect(result.opportunityScore).toBeCloseTo(Math.max(0, expected))
  })
})
