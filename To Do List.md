# hey future-me / coding-buddy — full workspace rebuild brain dump (pls read all, sorry it’s long lol)

Alright, we gotta ship the whole “Fashion Demand Forecast” thingy basically from zero Imagine the stakeholder is hovering behind us with coffee and a laser pointer Below is everything I scraped together; follow it like gospel even if some lines sound messy I didn’t have time to tidy the grammar, deal with it 🙏

## 0 vibe + product feel (don’t skip, sets the tone)
- Glassmorphism everywhere: frosted glass panes, neon-ish gradients, cinematic vibes Think “fashion merch executive using a holographic dashboard at 1 AM”
- Bilingual-ready: English/Thai toggle up in app state All copy driven from dictionaries, no hard-coded texts hiding anywhere pls
- Logged-out users see a hero splash with looping video Logged-in folks stay inside a 3-panel workspace (Forecast / History / Settings)
- The app must hot-swap between LightGBM historical vs metadata models—logic: if the user attaches recent-sales CSV -> go historical, else metadata

## 1 tech + tooling we promise to deliver
- Nextjs 14 App Router, TypeScript, React 18 Keep long-running work server-side on Node runtime (edge only where it make sense)
- Styling = Tailwind + CSS vars + local Product Sans + Montserrat Need blurred overlays and animated gradients sprinkled tastefully
- Charts via `react-chartjs-2` + `chartjs` Icons from `lucide-react`
- Forms handled with `react-hook-form` + `zod` validators
- State goodies: client hooks, streaming text updates with fetch + browser streams, optimistic uploads
- Supabase for auth/storage/Postgres BUT fallback to `data/` JSON artifacts if env keys missing (offline friendly)
- Auth: Supabase email OTP + Google OAuth Middleware keeps cookies fresh, server components call Supabase SSR helpers
- AI buddies (yes all of them):
  1 NVIDIA Llama 33 70B chat completions for CSV column guess, product cleanup, streaming insights
  2 NVIDIA Nemotron Ultra 253B double-checking the product form sanity
  3 Hugging Face Qwen25-VL-7B router for image metadata extraction (use Supabase signed URLs when we only have base64)
  4 Optional direct Hugging Face Space call through `NEXT_PUBLIC_FORECAST_SERVICE_URL`, else we fallback to our `/api/forecast`
- Python microservice (FastAPI or tiny Flask) wrapping LightGBM inference Lives beside Nextjs or on HF Space Need CLI entry + pinned deps

## 2 env setup (don’t forget to expose `envexample`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_IMAGE_BUCKET=product-images
FORECAST_SERVICE_URL=
FORECAST_SERVICE_TOKEN=
NEXT_PUBLIC_FORECAST_SERVICE_URL=
HF_TOKEN=
NVIDIA_API_KEY=
```
Graceful degradation mandatory when any value missing (no kaboom)

## 3 App architecture checklist (kinda strict)
- `app/layouttsx`: load Product Sans files, fetch language + settings server-side, seed Theme + Language providers, default dark mode
- `middlewarets`: wrap Supabase SSR helper, skip static assets, keep session hydrated
- Providers in `lib/theme/clienttsx`, `lib/i18n/clienttsx` handle toggles and dictionary contexts
- Protected routes live under `app/(routes)/` Each request verifies Supabase user, seeds `profiles` table if new, renders through `AppShell` with sticky nav
- Landing `/`: full-screen looping video (`/public/media/heromp4`), interactive hero title reacting to pointer, bilingual copy, CTAs linking Forecast/History/Settings

## 4 Forecast workflow (core flow, page `/forecast`)
- `ForecastForm` is the conductor
- Inputs: horizon slider (1–12), SKU, product title, category, color, sizes, cost, first sale month
- Optional uploads:
  - CSV of recent sales → when present prefer `lgbm_full`
  - Image upload → preview, reset, revoke blob URLs
- Storage rules:
  - If Supabase creds there → upload CSV to `exports` bucket, images to `product-images`, store public URLs
  - Else keep base64 in memory, still let users work
- Actions inside the form:
  - “Extract metadata” button hitting `/api/extract-meta` calling Qwen Autocomplete fields, warn if color is AI guessed
  - Auto validation on submit using `/api/validate-form` (Nemotron) Apply corrections when high confidence, show warnings
  - Submit builds `ForecastRequest` payload If `NEXT_PUBLIC_FORECAST_SERVICE_URL` present, hit Hugging Face Space queue; otherwise call our `/api/forecast`
- UX bits: disable buttons while busy, localized error strings, statuses explained (eg, “Saving…” not raw spinner)
- After success show `ForecastResult`: chart, insight pane, Save & Download
- Insight streaming: when `forecastsummary` empty call `/api/forecast/{id}/insight?lang=xx` and stream tokens into UI, display pulsing cursor while waiting

## 5 ForecastResult component
- Accepts `ForecastResponse`
- Shows: model badge (Historical vs No-Historical), chart (pred vs actual), metrics, y_pred table, download CSV, save action
- Keep styling consistent with glassmorphism theme (rounded translucent panels, neon edges)

## 6 History explorer (`/history`)
- Server fetch via `getForecastHistory`
- Layout: list of past runs on left (table or cards) Selecting item reveals detail panel with grid stats, chart, AI insight area
- Provide export link, show stored warning messages if any
- Bilingual support same as rest
- Works offline using `data/forecasts` JSON fallback

## 7 Settings (`/settings`)
- Form fields: display name, brand name, timezone, currency (default USD now), language toggle, theme toggle
- Use the same `react-hook-form` + zod pipeline
- On change, persist via `/api/settings` to Supabase or `data/settingsjson` fallback
- Theme switch updates immediately, use optimistic UI

## 8 Forecast API backend stuff
- Route `/api/forecast` orchestrates:
  - Normalize Thai inputs (category/color/sizes) when user typed Thai words
  - Validate with LLM (Nemotron) for corrections
  - Pull CSV (download and normalize) using queue of heuristics + LLM hints
  - Determine model key (historical vs metadata)
  - Build payload for Python service: categories uppercased, hashed product id, cost converted to USD (important new rule)
  - Call remote inference (or accept externally provided result)
  - Persist forecast + product metadata (respect Supabase or fallback JSON)
  - Return `ForecastResponse` with optional warning string
- Must support offline mode gracefully (fake heuristics, etc)

## 9 Python microservice spec (FastAPI/Flask)
- Accept the same `ForecastRequest` JSON (cost already in USD at this point)
- Generate features: month sin/cos, month_idx, age bucket one-hot, log cost, hashed product id, lag/rolling/EMA features for historical model
- Coerce categories/colors/sizes into uppercase enums
- If LightGBM pickle available → predict, convert from log scale with `expm1`, clamp to >= 0, round to int
- If missing → fallback heuristics (weight tables with category/color etc)
- Response format:
```json
{
  "model": "lgbm_full",
  "horizon": 6,
  "months": ["2024-06", ""],
  "y_pred": [1234, ""],
  "y_true": null,
  "metrics": {"rmse": 1234},
  "warning": "string or null"
}
```
- Provide CLI entry for local runs; `requirementstxt` pinned (numpy, pandas, scikit-learn, lightgbm, joblib, fastapi/flask, uvicorn)

## 10 Database (Supabase / Postgres)
- Tables: `profiles`, `products`, `sales_history`, `forecasts`, `ai_extracted_meta`, `settings`
- Enum `forecast_model`
- Storage buckets: `product-images` (public read), `exports` (protected)
- Triggers/functions:
  - `publicutcnow()` helper
  - Auto insert profile on new auth user
  - Touch `updated_at` on settings update
- RLS: allow authenticated read/update appropriately, service role can write as needed
- If migrating existing DB, run changes from `database/migrations/implement_2sql` (sets default currency USD + cleans old THB rows)

## 11 UI / UX spice
- Keep uppercase headings with tracking, pill buttons with hover lift
- Responsive layout down to mobile: nav collapses or becomes scrollable
- Accessibility: semantic headings, ARIA for modals/dialogs, focus outlines not hidden
- History detail uses split grid on desktop, stacked on mobile
- Charts viewable on dark background, use subtle grid lines

## 12 Resilience / fallback behavior
- No Supabase creds? Everything still works using `data/` JSON for settings & forecasts
- Streaming insight: if NVIDIA API fails, show static “Try again later” message
- CSV parsing must survive ugly headers via keyword search + LLM hints; include note strings about fallback decisions
- Image metadata: if HF token missing / call fails, fallback to heuristic guesses, show message
- Form validation: even if AI sanity check fails, allow the submit but warn loudly

## 13 Testing + verification
- Provide Jest/Vitest coverage for:
  - CSV normalization util
  - Forecast API pipeline (mock Python service + Supabase + translation)
  - Insight prompt builder
  - i18n dictionary lookup
- Bonus: Playwright smoke test for login + forecast submission (optional but nice)
- `npm run dev` should start clean with helpful warnings when env missing

## 14 Delivery to-dos
- TypeScript everywhere (no `any` sneaking in)
- Lint with `eslintconfigmjs`, formatting per Next defaults
- Document deploy steps in `DEPLOYMENT_GUIDEmd`, and LLM setup tips in `QWEN_INTEGRATIONmd` if we change anything
- Provide sample `data/forecasts` entry or instructions for offline demo

## 15 misc rules & reminders (read twice!)
- Voice in code/comments = professional, but the product experience must mirror this doc’s vibe
- Modularize aggressively; don’t dump a 600-line component
- Do **not** invent extra features beyond this list Perfect the ones here
- If an error pops up that we seriously can’t solve, just say so—don’t hack around silently
- Most important random rule from product: **DO NOT USE `useEffect`** unless it’s literally impossible without it They’re allergic to `useEffect`, so avoid it 99% of the time
- Deliver final output as runnable source Treat this prompt as the single source of truth; finishing it means the whole project is done in one go 😉
