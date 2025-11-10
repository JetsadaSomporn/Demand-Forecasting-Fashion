# Fashion Demand Forecast Workspace

Fashion Demand Forecast is a bilingual (English/Thai) workspace built for fashion merchandising teams who need cinematic-grade demand projections, streamlined collaboration, and resilient tooling that works online or offline. The platform blends a polished Next.js 14 experience with LightGBM inference, multimodal AI assistance, and Supabase-backed persistence.

**Demo Platform:** https://demand-forecasting-fashion.vercel.app/  
**Model Service:** https://huggingface.co/spaces/NewJetsada/Forecasting_Modeling

---

## Highlights

- Storytelling-ready forecasts with glassmorphism-inspired UI, real-time charting, AI-generated insights, and bilingual copy throughout the workflow.
- Adaptive modelling with automatic switching between historical and metadata LightGBM pipelines based on uploaded sales history.
- Human-in-the-loop AI using NVIDIA Llama 3.3 for CSV mapping and insights, and Qwen 2.5-VL for image metadata extraction.
- Offline-friendly operations with JSON-based fallbacks in `.data/` ensure forecasting, history, and settings persist even without Supabase credentials.
- Secure, scalable foundation where Supabase handles auth, storage, and Postgres; optional Hugging Face Space keeps long-running inference outside Vercel limits.
- Currency-aware cost handling where costs are captured in any configured currency and converted to USD before modelling to match training data.

---

## Architecture Overview

| Layer | Responsibility | Notes |
| --- | --- | --- |
| Next.js 14 App Router (TypeScript) | UX, routing, server components, API routes | Runs on Node runtime for long-lived tasks. Styling via Tailwind CSS, local Product Sans fonts, animated gradients. |
| Client providers | Theme and i18n contexts | `lib/theme/client.tsx` and `lib/i18n/client.tsx` keep UI synchronized with user settings and language selection. |
| Supabase | Auth, Postgres persistence, storage buckets | Email OTP + Google OAuth. Buckets: `product-images` (public), `exports` (protected). |
| Python inference service | LightGBM modelling | FastAPI/Flask app living beside Next.js or on Hugging Face Space. Receives normalized `ForecastRequest` payloads. |
| AI integrations | CSV & form intelligence, insights, metadata | NVIDIA Llama 3.3 for insights and Qwen 2.5-VL via Hugging Face Router for image analysis. Optional direct Hugging Face Space call using `NEXT_PUBLIC_FORECAST_SERVICE_URL`. |
| Offline data store | `.data/settings.json`, `.data/forecasts/*.json` | Mirrors Supabase schema for local development or outage scenarios. |

---

## Prerequisites
- Node.js 18.17+ (or the version specified in `.nvmrc`)
- npm (recommended) or pnpm / yarn / bun
- Python 3.10+ for the LightGBM service
- Supabase project (optional for production deployments)
- Access tokens for NVIDIA and Hugging Face endpoints if AI features are required

---

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Copy environment template**
   ```bash
   cp Example.env.example .env.local
   ```
   Fill in values as needed (see [Environment Variables](#environment-variables)).
3. **Run the development server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` to explore the workspace.
4. **(Optional) Start the Python inference API**
   ```bash
   cd python
   pip install -r requirements.txt
   uvicorn infer:app --reload --port 8000
   ```
   Update `FORECAST_SERVICE_URL` to point at the running instance.

---

## Environment Variables

| Key | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (omit for offline mode) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for client-side access |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key used by server routes |
| `SUPABASE_IMAGE_BUCKET` | Defaults to `product-images`; controls asset uploads |
| `FORECAST_SERVICE_URL` | Internal Python forecasting endpoint (FastAPI/Flask) |
| `FORECAST_SERVICE_TOKEN` | Optional bearer token for the forecasting service |
| `NEXT_PUBLIC_FORECAST_SERVICE_URL` | Optional Hugging Face Space queue URL to bypass Vercel timeouts |
| `HF_TOKEN` | Hugging Face API token for Qwen 2.5-VL image analysis via Router |
| `NVIDIA_API_KEY` | Access key for NVIDIA Llama services |

Unset variables trigger graceful degradation—offline forecasts are still possible using `.data/` fallbacks.

---

## Core Workflows

- **Forecast** – Upload optional sales CSV and product imagery, validate metadata through AI, then run forecasts with USD-normalized costs. Streamed insights populate automatically when available.
- **History** – Explore previous runs, download exports, review AI notes, and visualize predicted versus actual volumes.
- **Settings** – Configure workspace branding, timezone, active currency (USD default), language, and theme. Changes persist via Supabase or local JSON.

---

## Development Workflow

- **Linting** – `npm run lint`
- **Type checking** – `npm run typecheck`
- **Unit tests** – `npm run test` (Jest/Vitest suite covering CSV normalization, API pipeline, insight prompts, i18n lookup)
- **End-to-end (optional)** – Add Playwright scenarios for auth + forecast submission when desired.
- **Formatting** – Follows Next.js defaults (`eslint.config.mjs` enforces style). Avoid `useEffect` unless absolutely necessary—prefer server components, hooks, or effects-free patterns.

---

## Deployment

1. Provision environment variables on your hosting platform (Vercel recommended for Next.js).
2. Deploy the Python inference microservice alongside Next.js or host it on Hugging Face Space.
3. Enable Supabase storage buckets (`product-images`, `exports`) and run migrations, including `database/migrations/implement_2.sql`.
4. Update `DEPLOYMENT_GUIDE.md` with project-specific instructions as you iterate.

---

## Resilience & Troubleshooting

- **No Supabase credentials** – App falls back to local `.data/` files; forecasts, history, and settings stay operational.
- **AI service outages** – Insight streaming downgrades to static messaging; form validation still proceeds with warnings.
- **CSV anomalies** – Automatic header detection with keyword heuristics + LLM hints; users receive notes describing any fallbacks.
- **Currency mismatches** – Workspace settings define the active currency; system converts values to USD before modelling to maintain accuracy.

---

## Contributing

1. Fork and branch from `main` (or team-specific trunk).
2. Run `npm run lint` and `npm run test` before opening a pull request.
3. Document notable changes under `SYSTEM_VERIFICATION_REPORT.md` when applicable.

---

## License

This repository is proprietary and intended for internal use. Contact the maintainers for licensing questions or external collaboration requests.

---

## Need Support?

- Feature requests & bugs: open an issue or contact the engineering lead.
- Production incidents: follow the runbook in `DEPLOYMENT_GUIDE.md`.
