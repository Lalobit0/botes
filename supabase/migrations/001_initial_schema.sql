-- Schema aislado para Radar MX (no toca las tablas existentes en public)
-- Proyecto: STREAMBITAPP (nxwvkyfeaaywfmungqbh)
-- YA APLICADO en Supabase Dashboard. Este archivo es solo referencia.

create schema if not exists radar;

create table radar.products (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  keyword_busqueda text not null,
  categoria text,
  nicho text,
  notas text,
  estado text not null default 'nuevo'
    check (estado in ('nuevo','investigando','comprado','descartado')),
  created_at timestamptz default now()
);

create table radar.trend_signals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references radar.products(id) on delete cascade,
  fuente text not null check (fuente in ('tiktok','aliexpress','amazon_us','google_trends')),
  pais text not null default 'US',
  tipo_metrica text not null,
  valor numeric,
  rank int,
  tier text check (tier in ('emergente','creciente','establecida')),
  capturado_at timestamptz default now()
);

create table radar.mx_saturation (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references radar.products(id) on delete cascade,
  num_publicaciones int,
  precio_min numeric,
  precio_max numeric,
  precio_mediana numeric,
  aparece_en_ml_trends boolean default false,
  capturado_at timestamptz default now()
);

create table radar.margin_inputs (
  product_id uuid primary key references radar.products(id) on delete cascade,
  precio_origen_usd numeric,
  tipo_cambio numeric default 18.0,
  costo_envio_importacion_mxn numeric default 0,
  arancel_pct numeric default 0,
  iva_pct numeric default 16,
  precio_venta_estimado_mxn numeric
);

create table radar.opportunities (
  product_id uuid primary key references radar.products(id) on delete cascade,
  momentum_score numeric,
  saturacion_score numeric,
  margen_estimado_mxn numeric,
  margen_pct numeric,
  opportunity_score numeric,
  actualizado_at timestamptz default now()
);

-- RLS
alter table radar.products enable row level security;
alter table radar.trend_signals enable row level security;
alter table radar.mx_saturation enable row level security;
alter table radar.margin_inputs enable row level security;
alter table radar.opportunities enable row level security;

create policy "Acceso autenticado" on radar.products for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on radar.trend_signals for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on radar.mx_saturation for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on radar.margin_inputs for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on radar.opportunities for all using (auth.role() = 'authenticated');

-- Permisos a roles de Supabase
grant usage on schema radar to anon, authenticated, service_role;
grant all on all tables in schema radar to anon, authenticated, service_role;
grant all on all sequences in schema radar to anon, authenticated, service_role;
alter default privileges in schema radar grant all on tables to anon, authenticated, service_role;
alter default privileges in schema radar grant all on sequences to anon, authenticated, service_role;
