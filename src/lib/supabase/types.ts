export type ProductEstado = 'nuevo' | 'investigando' | 'comprado' | 'descartado'
export type TrendTier = 'emergente' | 'creciente' | 'establecida'
export type TrendFuente = 'tiktok' | 'aliexpress' | 'amazon_us' | 'google_trends'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      radar_products: {
        Row: {
          id: string
          nombre: string
          keyword_busqueda: string
          categoria: string | null
          nicho: string | null
          notas: string | null
          estado: ProductEstado
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          keyword_busqueda: string
          categoria?: string | null
          nicho?: string | null
          notas?: string | null
          estado?: ProductEstado
          created_at?: string
        }
        Update: {
          nombre?: string
          keyword_busqueda?: string
          categoria?: string | null
          nicho?: string | null
          notas?: string | null
          estado?: ProductEstado
        }
        Relationships: []
      }
      radar_trend_signals: {
        Row: {
          id: string
          product_id: string
          fuente: TrendFuente
          pais: string
          tipo_metrica: string
          valor: number | null
          rank: number | null
          tier: TrendTier | null
          capturado_at: string
        }
        Insert: {
          id?: string
          product_id: string
          fuente: TrendFuente
          pais?: string
          tipo_metrica: string
          valor?: number | null
          rank?: number | null
          tier?: TrendTier | null
          capturado_at?: string
        }
        Update: {
          product_id?: string
          fuente?: TrendFuente
          pais?: string
          tipo_metrica?: string
          valor?: number | null
          rank?: number | null
          tier?: TrendTier | null
        }
        Relationships: []
      }
      radar_mx_saturation: {
        Row: {
          id: string
          product_id: string
          num_publicaciones: number | null
          precio_min: number | null
          precio_max: number | null
          precio_mediana: number | null
          aparece_en_ml_trends: boolean
          capturado_at: string
        }
        Insert: {
          id?: string
          product_id: string
          num_publicaciones?: number | null
          precio_min?: number | null
          precio_max?: number | null
          precio_mediana?: number | null
          aparece_en_ml_trends?: boolean
          capturado_at?: string
        }
        Update: {
          num_publicaciones?: number | null
          precio_min?: number | null
          precio_max?: number | null
          precio_mediana?: number | null
          aparece_en_ml_trends?: boolean
        }
        Relationships: []
      }
      radar_margin_inputs: {
        Row: {
          product_id: string
          precio_origen_usd: number | null
          tipo_cambio: number
          costo_envio_importacion_mxn: number
          arancel_pct: number
          iva_pct: number
          precio_venta_estimado_mxn: number | null
        }
        Insert: {
          product_id: string
          precio_origen_usd?: number | null
          tipo_cambio?: number
          costo_envio_importacion_mxn?: number
          arancel_pct?: number
          iva_pct?: number
          precio_venta_estimado_mxn?: number | null
        }
        Update: {
          precio_origen_usd?: number | null
          tipo_cambio?: number
          costo_envio_importacion_mxn?: number
          arancel_pct?: number
          iva_pct?: number
          precio_venta_estimado_mxn?: number | null
        }
        Relationships: []
      }
      radar_opportunities: {
        Row: {
          product_id: string
          momentum_score: number | null
          saturacion_score: number | null
          margen_estimado_mxn: number | null
          margen_pct: number | null
          opportunity_score: number | null
          actualizado_at: string
        }
        Insert: {
          product_id: string
          momentum_score?: number | null
          saturacion_score?: number | null
          margen_estimado_mxn?: number | null
          margen_pct?: number | null
          opportunity_score?: number | null
          actualizado_at?: string
        }
        Update: {
          momentum_score?: number | null
          saturacion_score?: number | null
          margen_estimado_mxn?: number | null
          margen_pct?: number | null
          opportunity_score?: number | null
          actualizado_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Product = Database['public']['Tables']['radar_products']['Row']
export type TrendSignal = Database['public']['Tables']['radar_trend_signals']['Row']
export type MxSaturation = Database['public']['Tables']['radar_mx_saturation']['Row']
export type MarginInputs = Database['public']['Tables']['radar_margin_inputs']['Row']
export type Opportunity = Database['public']['Tables']['radar_opportunities']['Row']

export interface ProductConDetalle extends Product {
  radar_trend_signals: TrendSignal[]
  radar_mx_saturation: MxSaturation[]
  radar_margin_inputs: MarginInputs | null
  radar_opportunities: Opportunity | null
}
