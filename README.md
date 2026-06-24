# Radar MX — Detector de Oportunidades de Arbitraje

App personal para detectar productos con momentum en EE.UU./China que aún no están saturados en México.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend / DB:** Supabase (Postgres + Auth + Edge Functions)
- **Hosting:** Vercel (frontend) + Supabase (DB y cron)

## Fórmula

```
Oportunidad = Momentum_afuera − 0.7 × Saturación_México   (solo si Margen > 0)
```

## Puesta en marcha

### 1. Clonar y dependencias

```bash
npm install
```

### 2. Variables de entorno

Copia `.env.local.example` a `.env.local` y rellena los valores:

```bash
cp .env.local.example .env.local
```

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto en Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key del mismo panel |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo en servidor, nunca exponer) |
| `ML_CLIENT_ID` | ID de app de Mercado Libre (ver abajo) |
| `ML_CLIENT_SECRET` | Secret de la misma app |

### 3. Migraciones de base de datos

En el Dashboard de Supabase → SQL Editor, ejecuta el archivo:

```
supabase/migrations/001_initial_schema.sql
```

O con la CLI de Supabase:

```bash
npx supabase db push
```

### 4. Crear el usuario

En Supabase Dashboard → Authentication → Users → Invite user (o crear manualmente).
Solo se necesita un usuario.

### 5. Correr en local

```bash
npm run dev
```

## Credenciales de la API de Mercado Libre

1. Ir a https://developers.mercadolibre.com.mx/
2. Crear una aplicación con redirect URI `https://tu-dominio.vercel.app/api/auth/callback` (o `localhost` para desarrollo)
3. Seleccionar scopes: `read`
4. Copiar **Client ID** y **Client Secret** a `.env.local`

> Las credenciales se usan para el endpoint `/trends/MLM` (requiere OAuth).
> La búsqueda de saturación (`/sites/MLM/search`) funciona sin autenticación para uso básico.

## Cron semanal (Supabase Edge Function)

La función `cron-weekly-refresh` refresca datos de ML y recalcula scores cada lunes a las 6am.

### Deploy

```bash
npx supabase functions deploy cron-weekly-refresh
```

### Configurar el schedule

En Supabase Dashboard → Edge Functions → `cron-weekly-refresh` → Schedule:

```
0 6 * * 1
```

(Lunes a las 6am UTC)

### Variables de entorno en la Edge Function

En Supabase Dashboard → Edge Functions → Secrets, agrega:
- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`

## Tests

```bash
npm test
```

20 unit tests para la función de scoring (`calcularOportunidad`).

## Deploy en Vercel

1. Conectar el repositorio en https://vercel.com/new
2. Agregar las variables de entorno en el panel de Vercel
3. Deploy automático en cada push a `main`

## Fases

- **Fase 1 (MVP):** ML MX automático + captura manual TikTok/Amazon + calculadora margen
- **Fase 2:** Google Trends (pytrends) + AliExpress API + cron semanal
- **Fase 3:** Amazon PA-API + alertas por email/Telegram

## Fuentes automáticas

| Fuente | Qué aporta | Estado | Requiere |
|---|---|---|---|
| **Mercado Libre MX** (saturación: publicaciones + precios) | Competencia y precios en MX | ✍️ Captura manual | Nada — ML devuelve `403` en su API de búsqueda y bloquea el scraping (anti-bot). Se captura a mano en la ficha del producto (botón "Buscar en ML" + 3 campos). |
| **Google Trends** | Momentum US (pendiente de búsqueda) | ⚠️ Best-effort | Nada — pero Google suele bloquear IPs de servidor (403/429). Si falla, el refresco continúa sin el dato. |
| **Mercado Libre MX** (`/trends/MLM`) | Sugerencias / tendencia local + flag `aparece_en_ml_trends` | 🔑 Listo | `ML_CLIENT_ID`, `ML_CLIENT_SECRET` |
| **AliExpress** (hot products) | Descubrimiento automático de productos ganadores | 🔑 Listo | `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` |

La página **Descubrir** (`/descubrir`) lista productos sugeridos automáticamente desde AliExpress y las tendencias de ML MX (cuando hay credenciales). El momentum de Google Trends se calcula solo al pulsar "Refrescar momentum" y en el cron semanal.

> **Saturación MX (manual):** Mercado Libre cerró su API de búsqueda (`/sites/MLM/search` → `403 forbidden`, incluso con token de app) y su sitio público bloquea peticiones de servidor con anti-bot. Por eso el número de publicaciones y los precios se capturan a mano: en la ficha del producto hay un botón que abre la búsqueda de ML en tu dispositivo y campos para anotar lo que ves. El endpoint `POST /api/saturation/[productId]` guarda esos datos y recalcula el score.

> **TikTok y Amazon** siguen siendo captura manual (`/captura`): no permiten acceso automático sin aprobación de sus APIs (TikTok Research API / Amazon PA-API).
