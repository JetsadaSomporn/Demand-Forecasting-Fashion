# Prompt for Recreating the Fashion Demand Forecast Workspace

You are an elite full-stack engineer and product designer. Build the entire “Fashion Demand Forecast” workspace from scratch exactly as described below. Match the tone, UX polish, architecture, data flows, and AI integrations. Treat every detail as a requirement, not a suggestion

## 1. Core Vision
- Deliver a cinematic, glassmorphism-inspired B2B workspace for fashion merchandisers who need storytelling-grade demand forecasts
- Experience must feel bilingual-ready (English + Thai). Language toggle lives in app state and drives copy served by our dictionaries
- Logged-out users land on a hero splash. Authenticated users stay inside a tri-view workspace: Forecast workflow, History explorer, Settings controls
- System must auto-swap between historical and metadata-driven LightGBM models depending on whether the user uploads the recent-sales CSV

## 2. Tech Stack & Tooling
- Framework: Next.js 14 App Router (TypeScript, React 18, edge-friendly where sensible). Keep long-running work on the Node runtime
- Styling: Tailwind CSS with CSS variables, Montserrat/Product Sans local fonts, backdrop-blur overlays, and subtle animated gradients
- Charts: `react-chartjs-2` + `chart.js` for side-by-side forecast vs actuals.
- Icons: `lucide-react`.
- Forms: `react-hook-form` with `zod` validators
- State & enhancements: client-side hooks, streaming text updates via `fetch` + browser streams, optimistic UI for uploading assets
- Backend persistence: Supabase (Postgres + Auth + Storage). Local development must fall back to JSON artifacts in `.data/` when Supabase keys are missing
- Auth: Supabase email OTP + Google OAuth. Middleware refreshes cookies, server components use Supabase SSR helpers
- AI integrations:
	1. NVIDIA-hosted Llama 3.3 70B (chat completions API) for CSV column inference, product metadata normalization, and streaming insights
	2. NVIDIA Nemotron Ultra 253B for sanity-checking the product form
	3. Hugging Face Qwen2.5-VL-7B (router API) for image metadata extraction, with Supabase Storage signed URLs when we only have base64 images
	4. Optional direct Hugging Face Space call (`NEXT_PUBLIC_FORECAST_SERVICE_URL`) to bypass Vercel timeouts; otherwise call our own `/api/forecast`
- Python microservice: standalone FastAPI (or minimal Flask) endpoint wrapping LightGBM inference (see section 7). Deployed beside the Next.js app or on HF Space

## 3. Environment Variables
Expose an `.env.example` with the exact keys below. Application must gracefully degrade when a key is missing.


NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_IMAGE_BUCKET=product-images
FORECAST_SERVICE_URL= # URL of internal Python service (POST /forecast)
FORECAST_SERVICE_TOKEN=
NEXT_PUBLIC_FORECAST_SERVICE_URL= # Optional public HF Space queue endpoint
HF_TOKEN=
NVIDIA_API_KEY=


## 4. Application Architecture
- `app/layout.tsx`: load local Product Sans fonts, fetch language + settings on the server, seed Theme/Language providers, enforce dark mode default
- `middleware.ts`: wrap Supabase SSR middleware, skip static assets, keep sessions hydrated
- Providers: `lib/theme/client.tsx`, `lib/i18n/client.tsx` manage theme toggle + bilingual dictionary with context + hooks
- Protected routes live inside `app/(routes)/`. Each request verifies Supabase user, seeds `profiles` table if new, and renders via `AppShell` with sticky nav
- Landing page (`/`): fullscreen looping video background (`/public/media/hero.mp4`), animated `InteractiveTitle`, CTA buttons to Forecast / Settings / History. Copy respects current language

## 5. Feature Requirements

### 5.1 Forecast Workflow (`/forecast`)
- `ForecastForm` client component orchestrates the entire flow.
- Inputs: horizon (1-12 months slider), SKU, product title, category, color, sizes, cost, first sale month
- Optional uploads:
	- CSV (recent sales). When provided, switch to `lgbm_full` model; otherwise use `lgbm_meta`.
	- Image. Generate preview, allow reset, revoke blob URLs
- Supabase storage usage:
	- If creds exist, upload CSV to `exports` bucket, image to `product-images`. Store public URL. If not, keep base64 in memory
- `Extract metadata` button: POST `/api/extract-meta` with image URL/base64. Use Qwen to guess category/color/sizes/title. Show warning badge if AI guessed color
- `Validate` button (implicit on submit): `/api/validate-form` uses Nemotron to return field corrections + warnings. Auto-apply sanitized fields when high confidence
- On submit: Build payload matching `ForecastRequest` schema, call either Hugging Face Space (when `NEXT_PUBLIC_FORECAST_SERVICE_URL` is set) or internal `/api/forecast` route
- Show status messages, disable buttons during work, surface errors inline (localized)
- After success, display `ForecastResult` with chart, insight pane, Save + Download actions
- Insight streaming: if `forecast.summary` blank, open `/api/forecast/{id}/insight?lang=xx`, stream tokens into UI, show pulsing cursor while waiting

### 5.2 Forecast Result Component
- Accepts `ForecastResponse`. Format months using locale, show predicted vs actual table, Chart.js line graph, highlight whether live model or heuristic fallback
- Save button triggers `/api/export` (POST) to persist CSV to Supabase storage or `.data/exports`. Download button hits GET `/api/export?forecastId=...`
- Insight card uses `Sparkles` icon, shows streaming text, timestamp if available

### 5.3 History Explorer (`/history`)
- Server loads up to 50 past forecasts via `getForecastHistory` (Supabase or local JSON fallback)
- Client `HistoryTable` shows selectable rows, details panel with metadata, streaming insight refresh respecting language cache
- Provide CSV download shortcut in detail view, Chart.js visualization, and summary metadata grid

### 5.4 Settings Workspace (`/settings`)
- Server fetches defaults via `getSettingsDefaults` (fallback to `.data/settings.json`).
- Form fields: display name, brand name, timezone (select), currency (select), language (en/th), theme (radio cards) On save, POST `/api/settings`
- Backend behavior: if Supabase service key exists, upsert singleton row in `settings` table; otherwise persist JSON locally


### 5.5 Authentication Flows
- `/login`: minimalistic auth screen with brand header, email OTP form, Google button, legal modals for Terms/Privacy using dictionary copy
- `/auth/callback`: server route that calls `supabase.auth.exchangeCodeForSession`, redirects to `/forecast` or shows error query param
- `/logout`: server route clearing Supabase session and redirecting to `/login?message=signedOut`

## 6. API Surface (Next.js Route Handlers)
1. `POST /api/forecast`
	 - Validate body via `forecastRequestSchema` (zod). Accept optional `externalResult` when front-end calls HF Space directly
	 - Auto-translate Thai category/color/sizes into uppercase canonical tokens, call NVIDIA Llama to double-check metadata
	 - If CSV present, download file (handle Supabase public URL or base64) and normalize columns using LLM hints + keyword fallback
	 - Call Python service at `${FORECAST_SERVICE_URL}/forecast` with Bearer token. Fallback to heuristic if offline: generate month labels + smoothing
	 - Persist `forecasts` row (model, horizon, months, y_pred, y_true, params.product) into Supabase, or write `.data/forecasts/{id}.json` locally
	 - Return `ForecastResponse` with optional `forecastId`, `warning`, `summary` placeholder

2. `GET /api/forecast/[id]/insight`
	 - Load forecast (Supabase or local). Build prompt summarizing monthly projections, totals, growth, peak, trough
	 - Call NVIDIA Llama, stream plain-text insight (English or Thai). Cache to DB/local JSON with language + timestamp

3. `POST /api/extract-meta`
	 - Accept `imageUrl` or `imageBase64`. If base64 and Supabase service key exists, upload to storage and generate signed URL
	 - Call HF router (Qwen2.5-VL-7B). Normalize category/color/sizes, return structured JSON and confidence. Provide heuristic fallback using filename tokens if HF or env missing

4. `POST /api/validate-form`
	 - Guard with `NVIDIA_API_KEY`. Call Nemotron Ultra with strict JSON prompt. Return `isValid`, `suggestions`, `warnings`, `correctedProduct`. Fallback returns empty suggestions

5. `GET /api/export` & `POST /api/export`
	 - GET streams CSV for download. POST persists CSV to Supabase storage (`exports` bucket) or local `.data/exports` directory

6. `POST /api/settings`
	 - Validate payload via `settingsSchema`. If service role key available, insert/update singleton `settings` row; else write `.data/settings.json`

7. `POST /api/validate-form`, `POST /api/extract-meta`, and other routes must return localized error messages when possible

## 7. Python Forecast Service Requirements (`python/infer.py`)
- Language: Python 3.10+, FastAPI preferred (single `/forecast` POST endpoint)
- Load pickled LightGBM regressors from `usable_model/Historical_LightGBM.pkl` and `usable_model/No_Historical_LightGBM.pkl` using joblib
- Accept JSON payload:
	json
	{
		"model": "lgbm_full" | "lgbm_meta",
		"horizon": 6,
		"product": { "category": "FEMININE", "color": "BLACK", "sizes": "S|M|L|XL", "cost": 950, "first_sale_month": "2024-05-01", ... },
		"salesCsvContent": "data:text/csv;base64,..." | null,
		"salesCsvUrl": "https://..." | null
	}
	
- Parse CSV (URL or base64) into tidy month→quantity map, aggregate duplicates, fill gaps with zero
- Feature engineering must match training pipeline: month sine/cosine, month_idx, age buckets, lags, rolling means, EMAs, cost log, hashed product id, etc
- Coerce categories/colors/sizes into exact uppercase enums pre-defined in the model
- Return:
	json 
	{
		"model": "lgbm_full",
		"horizon": 6,
		"months": ["2024-06", ...],
		"y_pred": [123.4, ...],
		"y_true": null,
		"metrics": {"rmse": ...},
		"warning": "..."
	}
	
- Include fallback heuristics if pickle missing: simple weighted seasonality using category/color weight tables
- Production-ready packaging: `requirements.txt` pinned versions (numpy, pandas, scikit-learn, lightgbm, joblib)Provide CLI entry point for local debugging

## 8. Database Schema (Supabase/Postgres)
- Reproduce schema from `database/schema.sql`:
	- `profiles`, `products`, `sales_history`, `forecasts`, `ai_extracted_meta`, `settings` tables
	- `forecast_model` enum
	- RLS policies allowing authenticated access, service-role writes where needed
	- Buckets: `product-images` (public read) + `exports` (private, authenticated access)
	- Helper functions/triggers: `utcnow()`, profile auto-insert trigger, settings `updated_at` touch trigger

## 9. UI/UX Detailing
- Global glassmorphism aesthetic: gradients, radial overlays, neon glows, uppercase tracking-heavy headings
- `InteractiveTitle`: animated split text that responds to pointer movement
- Buttons: pill-shaped, uppercase with tracking, shadows that lift on hover
- Layout: fixed header with brand + navigation, content padded top to avoid overlap, responsive down to mobile (nav collapses into horizontal scroll)
- History detail panel uses split grid layout on desktop, stacked on mobile
- Accessibility: semantic headings, ARIA on modals, focus outlines
- Localization: `lib/i18n` dictionaries (en/th) covering nav, forms, error states, tooltips, legal copy

## 10. Resilience & Fallbacks
- If Supabase creds missing, operate entirely on `.data/forecasts/*.json` and `.data/settings.json`. All APIs must survive offline mode 
- Insight streaming should degrade to a static “try again later” message when NVIDIA API unavailable
- CSV parsing must handle weird headers via keyword detection + LLM hints. Include informative notes on fallbacks in the response
- Image extraction must gracefully fallback to heuristic guesses when HF token missing or request fails
- Form validation fallback: allow submission but warn the user

## 11. Testing & Verification
- Provide Jest or Vitest coverage for:
	- CSV normalization utilities
	- Forecast API pipeline (mock Python service, Supabase writes, translation helpers)
	- Insight prompt builder
	- i18n dictionary lookup
- Add Playwright smoke scenario (optional) for auth + forecast submission

## 12. Delivery Checklist
- Fully typed TypeScript, no `any`
- Lintable via `eslint.config.mjs`, formatted with Next.js defaults
- `npm run dev` bootstraps app with environment fallback warnings
- Document deployment steps in `DEPLOYMENT_GUIDE.md` and LLM setup in `QWEN_INTEGRATION.md` if adjustments needed
- Include seed `.data/forecasts` example or instructions to create one for offline demo

When you produce code, keep the voice professional, modularize aggressively, and mirror the exact product feel described. Do not invent additional features; perfect the ones listed. Output complete, runnable source
the last one you must to do is DO NOT USING "Use Effect" it a useless unless it have to use But MOSTLY Dont use it 
Any Error You can't Fix Just tell me Do not Try to fix, it Doesn't Work
