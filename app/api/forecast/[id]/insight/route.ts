import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import { callLlama } from "@/lib/llm";

const LOCAL_FORECAST_DIR = path.join(process.cwd(), ".data/forecasts");

type ForecastRecord = {
  id: string;
  model_name: "lgbm_full" | "lgbm_meta";
  horizon: number;
  months: string[];
  y_pred: number[];
  created_at?: string;
  params?: {
    product?: {
      title?: string | null;
      sku?: string | null;
      category?: string | null;
    };
  };
  summary?: string | null;
  summary_language?: string | null;
  summary_created_at?: string | null;
};

type LoadedForecast = ForecastRecord & {
  productLabel: string;
};

async function loadForecastFromSupabase(id: string): Promise<ForecastRecord | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("forecasts")
    .select("id, model_name, horizon, months, y_pred, created_at, params, summary, summary_language, summary_created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Insight] Supabase fetch error:", error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    model_name: data.model_name,
    horizon: data.horizon,
    months: (data.months as string[]) ?? [],
    y_pred: (data.y_pred as number[]) ?? [],
    created_at: data.created_at ?? undefined,
    params: data.params as ForecastRecord["params"],
    summary: (data.summary as string | null) ?? null,
    summary_language: (data.summary_language as string | null) ?? null,
    summary_created_at: (data.summary_created_at as string | null) ?? null,
  };
}

async function loadForecastFromFile(id: string): Promise<ForecastRecord | null> {
  const filePath = path.join(LOCAL_FORECAST_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as ForecastRecord & { months: string[]; y_pred: number[] };
    return parsed;
  } catch (error) {
    console.warn("[Insight] Local forecast read error:", error);
    return null;
  }
}

async function loadForecast(id: string): Promise<LoadedForecast | null> {
  const record = isSupabaseConfigured("service")
    ? await loadForecastFromSupabase(id)
    : await loadForecastFromFile(id);

  if (!record) return null;

  const product = record.params?.product ?? {};
  const productLabel =
    product.title?.trim() ||
    product.sku?.trim() ||
    product.category?.trim() ||
    "Unnamed product";

  return {
    ...record,
    productLabel,
  };
}

function buildSummaryPrompt(record: LoadedForecast, language: "en" | "th") {
  const pairs = record.months.map((month, index) => {
    const rawValue = Number((record.y_pred ?? [])[index]);
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    return { month, value };
  });

  const total = pairs.reduce((sum, pair) => sum + pair.value, 0);
  const average = pairs.length ? total / pairs.length : 0;
  const peak = pairs.reduce(
    (current, pair) => (pair.value > current.value ? pair : current),
    pairs[0] ?? { month: "", value: 0 }
  );
  const trough = pairs.reduce(
    (current, pair) => (pair.value < current.value ? pair : current),
    pairs[0] ?? { month: "", value: 0 }
  );
  const first = pairs[0] ?? { month: "", value: 0 };
  const last = pairs[pairs.length - 1] ?? { month: "", value: 0 };
  const growth = first.value === 0 ? last.value : ((last.value - first.value) / Math.max(first.value, 1)) * 100;

  const formattedPairs = pairs
    .map((pair) => `- ${pair.month}: ${Math.round(pair.value)}`)
    .join("\n");

  const instructions =
    language === "th"
      ? "ตอบเป็นภาษาไทยแบบกระชับ มืออาชีพ ไม่เกิน 3 ประโยค เน้นมุมมองสินค้าและสต๊อกที่ทำได้จริง"
      : "Respond in concise, professional English (max 3 sentences) with actionable merchandising takeaways.";

  return `You are a fashion merchandising analyst. Summarize the forecast result for stakeholders without mentioning the forecasting model or LightGBM.

Product: ${record.productLabel}
Horizon: ${record.horizon} months
Generated: ${record.created_at ?? "unknown"}

Forecasted monthly demand:
${formattedPairs}

Totals and highlights:
- Total demand: ${Math.round(total)}
- Average per month: ${Math.round(average)}
- Peak month: ${peak.month} (${Math.round(peak.value)})
- Lowest month: ${trough.month} (${Math.round(trough.value)})
- Start vs end: ${first.month} ➝ ${last.month}
- Percent change: ${Number.isFinite(growth) ? growth.toFixed(1) : "0"}%

${instructions}
Do not refer to the forecasting engine or methodology.
Mention if demand accelerates, stabilises, or declines, and suggest next actions (inventory, marketing, timing). Plain text only.`;
}

function createStreamingResponse(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,14}\s?/g) ?? [text];
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function persistSummary(
  record: LoadedForecast,
  summary: string,
  language: "en" | "th"
) {
  const summaryCreatedAt = new Date().toISOString();

  if (isSupabaseConfigured("service")) {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("forecasts")
      .update({
        summary,
        summary_language: language,
        summary_created_at: summaryCreatedAt,
      })
      .eq("id", record.id);

    if (error) {
      console.error("[Insight] Failed to persist summary to Supabase:", error);
    }
  } else {
    try {
      await fs.mkdir(LOCAL_FORECAST_DIR, { recursive: true });
      const filePath = path.join(LOCAL_FORECAST_DIR, `${record.id}.json`);
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      parsed.summary = summary;
      parsed.summary_language = language;
      parsed.summary_created_at = summaryCreatedAt;
      await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");
    } catch (error) {
      console.warn("[Insight] Failed to persist summary locally:", error);
    }
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: forecastId } = await context.params;
    if (!forecastId) {
      return NextResponse.json({ error: "Forecast ID required" }, { status: 400 });
    }

    const record = await loadForecast(forecastId);
    if (!record) {
      return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const languageParam = url.searchParams.get("lang");
    const language: "en" | "th" = languageParam === "th" ? "th" : "en";

    if (record.summary && record.summary_language === language) {
      return createStreamingResponse(record.summary);
    }

    const prompt = buildSummaryPrompt(record, language);
    const rawResponse = await callLlama(prompt, {
      maxTokens: 220,
      temperature: 0.25,
    });

    if (!rawResponse) {
      const fallback = language === "th"
        ? "ไม่สามารถสร้างสรุปผลได้ ลองอีกครั้งภายหลังนะคะ"
        : "Unable to generate an insight right now. Please try again later.";
      return createStreamingResponse(fallback);
    }

    const summary = rawResponse.trim();
    await persistSummary(record, summary, language);
    return createStreamingResponse(summary);
  } catch (error) {
    console.error("[Insight] Unexpected error:", error);
    return NextResponse.json(
      { error: "Insight generation failed" },
      { status: 500 }
    );
  }
}
