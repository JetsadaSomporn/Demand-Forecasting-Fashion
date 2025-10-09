import { createSupabaseServiceClient, isSupabaseConfigured } from "./supabase";
import { promises as fs } from "fs";
import path from "path";
import { resolveLanguage } from "@/lib/i18n";

export type ForecastSummary = {
  id: string;
  product: {
    sku?: string | null;
    title?: string | null;
    category?: string | null;
    color?: string | null;
    sizes?: string | null;
    cost?: number | null;
    first_sale_month?: string | null;
  };
  model_name: "lgbm_full" | "lgbm_meta";
  horizon: number;
  created_at: string;
};

export type ForecastDetail = ForecastSummary & {
  y_pred: number[];
  y_true?: number[] | null;
  months: string[];
};

const LOCAL_SETTINGS_PATH = path.join(process.cwd(), ".data/settings.json");

async function readLocalSettings() {
  try {
    const raw = await fs.readFile(LOCAL_SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

const LOCAL_FORECAST_DIR = path.join(process.cwd(), ".data/forecasts");

async function readLocalForecasts(limit: number): Promise<ForecastDetail[]> {
  try {
    const dir = await fs.readdir(LOCAL_FORECAST_DIR, { withFileTypes: true });
    const items: ForecastDetail[] = [];
    for (const entry of dir) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(LOCAL_FORECAST_DIR, entry.name), "utf8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeForecastDetail({
        id: parsed.id ?? entry.name.replace(".json", ""),
        model_name: parsed.model_name ?? "lgbm_meta",
        horizon: parsed.horizon ?? (parsed.months?.length ?? 0),
        params: parsed.params ?? { product: parsed.product ?? null, months: parsed.months, plot: parsed.plot },
        y_pred: parsed.y_pred,
        y_true: parsed.y_true,
        months: parsed.months,
        product: parsed.product ?? parsed.params?.product ?? null,
        created_at: parsed.created_at ?? new Date().toISOString(),
      });
      items.push(normalized);
    }
    items.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") * -1);
    return items.slice(0, limit);
  } catch {
    return [];
  }
}

const FALLBACK_FORECASTS: ForecastDetail[] = [];

type ForecastProductRecord = {
  sku?: string | null;
  title?: string | null;
  category?: string | null;
  color?: string | null;
  sizes?: string | null;
  cost?: number | string | null;
  first_sale_month?: string | null;
};

type ForecastParams = {
  months?: unknown;
  product?: ForecastProductRecord | null;
  plot?: {
    months?: unknown;
    seed?: { months?: unknown; values?: unknown } | null;
  } | null;
  y_pred?: unknown;
  y_true?: unknown;
};

type SupabaseForecastRow = {
  id: string;
  model_name: "lgbm_full" | "lgbm_meta";
  horizon: number;
  params?: ForecastParams | null;
  y_pred?: unknown;
  y_true?: unknown;
  months?: unknown;
  products?:
    | { sku?: string | null; title?: string | null; category?: string | null; color?: string | null; sizes?: string | null; cost?: number | null; first_sale_month?: string | null }
    | Array<{ sku?: string | null; title?: string | null; category?: string | null; color?: string | null; sizes?: string | null; cost?: number | null; first_sale_month?: string | null }>
    | null;
  product?: { sku?: string | null; title?: string | null; category?: string | null; color?: string | null; sizes?: string | null; cost?: number | null; first_sale_month?: string | null } | null;
  product_sku?: string | null;
  created_at: string;
};

type ForecastRowLike = {
  id: string;
  model_name: "lgbm_full" | "lgbm_meta";
  horizon: number;
  params?: ForecastParams | null;
  y_pred?: unknown;
  y_true?: unknown;
  months?: unknown;
  products?:
    | ForecastProductRecord
    | ForecastProductRecord[]
    | null;
  product?: ForecastProductRecord | null;
  product_sku?: string | null;
  created_at: string;
};

function mapForecastRow(row: SupabaseForecastRow): ForecastDetail {
  return normalizeForecastDetail(row);
}

export async function getRecentForecasts(limit = 4): Promise<ForecastSummary[]> {
  if (!isSupabaseConfigured("service")) {
    const local = await readLocalForecasts(limit);
    if (local.length) return local;
    return FALLBACK_FORECASTS.slice(0, limit);
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("forecasts")
      .select(
        "id, model_name, horizon, metrics, created_at, product_id, y_pred, y_true, months, params, products:product_id ( sku, title, category, color )"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.warn("Failed to load recent forecasts", error);
      const local = await readLocalForecasts(limit);
      if (local.length) return local;
      return FALLBACK_FORECASTS.slice(0, limit);
    }

    return data.map(mapForecastRow);
  } catch (error) {
    console.error("Supabase recent forecasts error", error);
    const local = await readLocalForecasts(limit);
    if (local.length) return local;
    return FALLBACK_FORECASTS.slice(0, limit);
  }
}

export async function getForecastHistory(limit = 50) {
  if (!isSupabaseConfigured("service")) {
    const local = await readLocalForecasts(limit);
    if (local.length) return local;
    return FALLBACK_FORECASTS.slice(0, limit);
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("forecasts")
      .select(
        "id, model_name, horizon, metrics, created_at, product_id, y_pred, y_true, months, params, products:product_id ( sku, title, category, color )"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.warn("Failed to load history", error);
      const local = await readLocalForecasts(limit);
      if (local.length) return local;
      return FALLBACK_FORECASTS.slice(0, limit);
    }

    return data.map(mapForecastRow);
  } catch (error) {
    console.error("Supabase history error", error);
    const local = await readLocalForecasts(limit);
    if (local.length) return local;
    return FALLBACK_FORECASTS.slice(0, limit);
  }
}

export async function getSettingsDefaults() {
  const local = await readLocalSettings();

  const base = {
    displayName: local?.displayName ?? "",
    brandName: local?.brandName ?? "",
    timezone: local?.timezone ?? "Asia/Bangkok",
    currency: local?.currency ?? "THB",
    language: resolveLanguage(local?.language),
  };

  if (!isSupabaseConfigured("service")) {
    return base;
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("settings")
      .select("brand_name, display_name, timezone, currency")
      .limit(1)
      .single();

    if (error || !data) {
      return base;
    }

    return {
      displayName: data.display_name ?? base.displayName,
      brandName: data.brand_name ?? base.brandName,
      timezone: data.timezone ?? base.timezone,
      currency: data.currency ?? base.currency,
      language: base.language,
    };
  } catch (error) {
    console.error("Supabase settings error", error);
    return base;
  }
}

function normalizeForecastDetail(row: ForecastRowLike): ForecastDetail {
  const params = (row.params ?? {}) as ForecastParams;

  const productCandidate = (Array.isArray(row.products)
    ? row.products[0]
    : row.products ?? row.product ?? params.product ?? {}) as ForecastProductRecord | undefined;

  const product = {
    sku:
      productCandidate?.sku ??
      row.product_sku ??
      params.product?.sku ??
      null,
    title: productCandidate?.title ?? params.product?.title ?? null,
    category: productCandidate?.category ?? params.product?.category ?? null,
    color: productCandidate?.color ?? params.product?.color ?? null,
    sizes: productCandidate?.sizes ?? params.product?.sizes ?? null,
    cost: normalizeNumber(
      productCandidate?.cost ?? params.product?.cost ?? null
    ),
    first_sale_month:
      productCandidate?.first_sale_month ??
      params.product?.first_sale_month ??
      null,
  };

  const monthsFromRow = ensureStringArray(row.months);
  const monthsFromParams = ensureStringArray(params.months);
  const monthsFromPlot = ensureStringArray(params.plot?.months);

  const resolvedMonths =
    monthsFromRow.length > 0
      ? monthsFromRow
      : monthsFromParams.length > 0
      ? monthsFromParams
      : monthsFromPlot.length > 0
      ? monthsFromPlot
      : generateMonthLabels(product.first_sale_month, row.horizon, row.created_at);

  const resolvedHorizon =
    row.horizon && row.horizon > 0 ? row.horizon : resolvedMonths.length;

  const predictions = ensureNumberArray(row.y_pred);
  const actuals = ensureNumberArray(row.y_true);

  const detail: ForecastDetail = {
    id: row.id,
    product,
    model_name: row.model_name,
    horizon: resolvedHorizon,
    y_pred: predictions,
    y_true: actuals.length ? actuals : null,
    months: resolvedMonths,
    created_at: row.created_at,
  };

  if (!detail.months.length) {
    detail.months = generateMonthLabels(
      detail.product.first_sale_month,
      detail.horizon,
      row.created_at
    );
  }

  if (!detail.y_pred.length) {
    detail.y_pred = generateHeuristicForecast(detail);
  }

  if (detail.y_pred.length !== detail.months.length) {
    const heuristic = generateHeuristicForecast(detail);
    if (heuristic.length) {
      detail.y_pred = heuristic.slice(0, detail.months.length);
    } else if (detail.y_pred.length > detail.months.length) {
      detail.y_pred = detail.y_pred.slice(0, detail.months.length);
    }
  }

  if (detail.y_true && detail.y_true.length > detail.months.length) {
    detail.y_true = detail.y_true.slice(0, detail.months.length);
  }

  return detail;
}

function ensureStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item == null) return "";
        return String(item).trim();
      })
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === "string" ? item.trim() : String(item)))
            .filter((item) => item.length > 0);
        }
      } catch {
        // ignore
      }
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((part) => part.replace(/["{}]/g, "").trim())
        .filter((part) => part.length > 0);
    }

    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }

    return [trimmed];
  }

  return [];
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function ensureNumberArray(value: unknown): number[] {
  if (!value) return [];

  const convert = (input: unknown): number | null => {
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input === "string") {
      const parsed = Number(input);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  if (Array.isArray(value)) {
    return value
      .map((item) => convert(item))
      .filter((item): item is number => item != null);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => convert(item))
            .filter((item): item is number => item != null);
        }
      } catch {
        // ignore
      }
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((part) => part.replace(/["{}]/g, "").trim())
        .map((part) => convert(part))
        .filter((item): item is number => item != null);
    }

    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((part) => convert(part.trim()))
        .filter((item): item is number => item != null);
    }

    const single = convert(trimmed);
    return single != null ? [single] : [];
  }

  return [];
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  feminine: 12,
  menswear: 15,
  outerwear: 18,
  athleisure: 10,
  denim: 14,
  footwear: 16,
};

const COLOR_WEIGHTS: Record<string, number> = {
  black: 10,
  white: 6,
  beige: 5,
  blue: 8,
  green: 7,
  pink: 5,
  purple: 6,
  red: 9,
  gray: 6,
};

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function parseMonthValue(value: string | null | undefined): Date {
  if (!value) {
    return startOfMonth(new Date());
  }

  const match = value.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return new Date(Date.UTC(year, Math.min(Math.max(month, 1), 12) - 1, 1));
    }
  }

  const parsed = new Date(value);
  if (Number.isFinite(parsed.getTime())) {
    return startOfMonth(parsed);
  }

  return startOfMonth(new Date());
}

function addMonthsToDate(date: Date, offset: number): Date {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const totalMonths = year * 12 + monthIndex + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonthIndex = totalMonths % 12;
  return new Date(Date.UTC(nextYear, nextMonthIndex, 1));
}

function formatMonth(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date
    .getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
}

function generateMonthLabels(
  firstSaleMonth: string | null | undefined,
  horizon: number,
  createdAt?: string
): string[] {
  const effectiveHorizon = horizon > 0 ? horizon : 0;
  if (!effectiveHorizon) return [];

  const firstSale = parseMonthValue(firstSaleMonth);
  const created = createdAt ? parseMonthValue(createdAt) : startOfMonth(new Date());
  const base = Number.isFinite(firstSale.getTime())
    ? addMonthsToDate(firstSale, 1)
    : created;

  return Array.from({ length: effectiveHorizon }, (_, idx) =>
    formatMonth(addMonthsToDate(base, idx))
  );
}

function monthDiff(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  );
}

function hashOffset(seed: string): number {
  let total = 0;
  for (const char of seed) {
    total += char.charCodeAt(0);
  }
  return (total % 17) - 8;
}

function generateHeuristicForecast(detail: ForecastDetail): number[] {
  const horizon = detail.months.length || detail.horizon;
  if (!horizon) return [];

  const modelKey = detail.model_name;
  const product = detail.product ?? {};
  const sku = (product.sku || "SKU").toString().toUpperCase();
  const cost = Math.max(1, normalizeNumber(product.cost) ?? 1);
  const category = (product.category || "").toString().toLowerCase();
  const color = (product.color || "").toString().toLowerCase();
  const sizes = (product.sizes || "").toString();
  const firstSale = parseMonthValue(product.first_sale_month);

  const monthDates = detail.months.map((label, index) => {
    const parsed = parseMonthValue(label);
    if (!parsed || !Number.isFinite(parsed.getTime())) {
      const fallback = addMonthsToDate(firstSale, index + 1);
      return fallback;
    }
    return parsed;
  });

  const seasonalScale = modelKey === "lgbm_full" ? 12 : 10;
  const baseLevel = modelKey === "lgbm_full" ? 110 : 85;
  const categoryWeight = CATEGORY_WEIGHTS[category] ?? 5;
  const colorWeight = COLOR_WEIGHTS[color] ?? 4;
  const sizeCount = sizes
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean).length;
  const sizeWeight = sizeCount * 4;
  const costWeight =
    Math.log1p(cost) * (modelKey === "lgbm_meta" ? 6 : 8);
  const skuOffset = hashOffset(sku);

  return monthDates.map((targetMonth, idx) => {
    const age = Math.max(0, monthDiff(firstSale, targetMonth));
    const ageDecay = Math.max(0, age - 12) * 1.8;
    const monthNumber = targetMonth.getUTCMonth() + 1;
    const seasonal = Math.sin((2 * Math.PI * monthNumber) / 12);
    const trend = idx * (modelKey === "lgbm_full" ? 2.5 : 1.5);

    const estimate =
      baseLevel +
      costWeight +
      categoryWeight +
      colorWeight +
      sizeWeight +
      seasonal * seasonalScale +
      trend +
      skuOffset -
      ageDecay;

    return Math.max(0, Math.round((estimate + Number.EPSILON) * 100) / 100);
  });
}
