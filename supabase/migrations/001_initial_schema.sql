-- Catálogo normalizado de productos/keywords
create table products (
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

-- Señales crudas de momentum desde fuentes externas
create table trend_signals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  fuente text not null check (fuente in ('tiktok','aliexpress','amazon_us','google_trends')),
  pais text not null default 'US',
  tipo_metrica text not null,
  valor numeric,
  rank int,
  tier text check (tier in ('emergente','creciente','establecida')),
  capturado_at timestamptz default now()
);

-- Foto de saturación en Mercado Libre MX
create table mx_saturation (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  num_publicaciones int,
  precio_min numeric,
  precio_max numeric,
  precio_mediana numeric,
  aparece_en_ml_trends boolean default false,
  capturado_at timestamptz default now()
);

-- Datos de costo para calcular margen
create table margin_inputs (
  product_id uuid primary key references products(id) on delete cascade,
  precio_origen_usd numeric,
  tipo_cambio numeric default 18.0,
  costo_envio_importacion_mxn numeric default 0,
  arancel_pct numeric default 0,
  iva_pct numeric default 16,
  precio_venta_estimado_mxn numeric
);

-- Score calculado
create table opportunities (
  product_id uuid primary key references products(id) on delete cascade,
  momentum_score numeric,
  saturacion_score numeric,
  margen_estimado_mxn numeric,
  margen_pct numeric,
  opportunity_score numeric,
  actualizado_at timestamptz default now()
);

-- RLS: solo usuarios autenticados
alter table products enable row level security;
alter table trend_signals enable row level security;
alter table mx_saturation enable row level security;
alter table margin_inputs enable row level security;
alter table opportunities enable row level security;

create policy "Acceso autenticado" on products for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on trend_signals for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on mx_saturation for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on margin_inputs for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on opportunities for all using (auth.role() = 'authenticated');
