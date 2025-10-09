import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  forecastRequestSchema,
  type ForecastRequest,
  forecastResponseSchema,
  type ForecastResponse,
} from "@/lib/validators";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const LOCAL_FORECAST_DIR = path.join(process.cwd(), ".data/forecasts");

type PythonForecastResponse = {
  model: "lgbm_full" | "lgbm_meta";
  horizon: number;
  y_pred: number[];
  y_true?: number[] | null;
  metrics?: Record<string, number> | null;
  months: string[];
  warning?: string;
  plot?: { months?: string[]; seed?: { months?: string[]; values?: number[] } };
  error?: string;
};

type LlamaChatOptions = {
  maxTokens?: number;
};

async function callLlama(prompt: string, options: LlamaChatOptions = {}) {
  if (!NVIDIA_API_KEY) {
    console.log("[LLM] No API key configured");
    return null;
  }

  const { maxTokens = 200 } = options;

  try {
    console.log("[LLM] Calling Llama 3.3 70B...");
    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? null;
    if (!content) {
      console.error("[LLM] No content in response");
      return null;
    }
    console.log("[LLM] Response:", content);
    return content;
  } catch (error) {
    console.error("[LLM] Request error:", error);
    return null;
  }
}

function sanitizeText(value: string | null | undefined) {
  if (!value) return "__NA__";
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "__NA__";
}

async function validateWithLlama(product: ForecastRequest["product"]): Promise<{ correctedProduct: Record<string, string> | null }> {
  const prompt = `Map to valid values. All values must be UPPERCASE.

VALID CATEGORIES: FEMININE, MASCULINE, CHILDREN
Map: women/woman/female/ladies/girls → FEMININE
Map: men/man/male/boys/menswear → MASCULINE
Map: kids/kid/child/children/baby/toddler → CHILDREN

COLORS: BLACK, WHITE, BLUE, RED, GREEN, PINK, PURPLE, BEIGE, GRAY, BROWN (uppercase)
SIZES: Keep format with pipes, uppercase (e.g., S|M|L)

Input: Category="${product.category}", Color="${product.color}", Sizes="${product.sizes}"

JSON only:
{"category":"MASCULINE","color":"RED","sizes":"S|M|L"}`;

  const content = await callLlama(prompt, { maxTokens: 120 });
  if (!content) {
    return { correctedProduct: null };
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error("[LLM] No JSON found in content");
      return { correctedProduct: null };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    console.log("[LLM] Parsed result:", parsed);
    return { correctedProduct: parsed };
  } catch (error) {
    console.error("[LLM] Validation error:", error);
    return { correctedProduct: null };
  }
}

type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

type CsvColumnDetection = {
  monthIndex: number;
  quantityIndex: number;
  monthHeader: string;
  quantityHeader: string;
  source: "llama" | "fallback";
};

type CsvNormalizationResult = {
  content: string;
  note?: string;
  detection?: CsvColumnDetection;
};

type LlamaCsvResponse = {
  month_column?: string | null;
  quantity_column?: string | null;
};

const MONTH_KEYWORDS = [
  "month",
  "monthlabel",
  "date",
  "period",
  "orderdate",
  "invoicedate",
  "salesdate",
  "yearmonth",
  "ym",
];

const QUANTITY_KEYWORDS = [
  "qty",
  "quantity",
  "units",
  "unitssold",
  "salesunits",
  "sold",
  "volume",
  "demand",
  "shipqty",
  "orderqty",
  "orders",
  "salesqty",
];

function decodeCsvBase64(encoded: string | null | undefined) {
  if (!encoded) return null;
  try {
    const payload = encoded.startsWith("data:") ? encoded.split(",", 1)[1] ?? "" : encoded;
    if (!payload) return null;
    return Buffer.from(payload, "base64").toString("utf8");
  } catch (error) {
    console.warn("[CSV] Failed to decode base64:", error);
    return null;
  }
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function parseCsv(content: string): CsvParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  return { headers, rows };
}

function normalizeHeaderName(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchColumn(
  candidate: string | null | undefined,
  keywords: readonly string[],
  headers: string[],
  normalizedHeaders: string[]
): { index: number; header: string; source: "llama" | "fallback" } | null {
  if (candidate && candidate.trim()) {
    const normalizedCandidate = normalizeHeaderName(candidate);
    let index = normalizedHeaders.findIndex((value) => value === normalizedCandidate);
    if (index === -1) {
      index = normalizedHeaders.findIndex((value) => value.includes(normalizedCandidate));
    }
    if (index === -1) {
      const lowered = candidate.trim().toLowerCase();
      index = headers.findIndex((value) => value.trim().toLowerCase() === lowered);
    }
    if (index !== -1) {
      return {
        index,
        header: headers[index],
        source: "llama",
      };
    }
  }

  for (const keyword of keywords) {
    const index = normalizedHeaders.findIndex((value) => value.includes(keyword));
    if (index !== -1) {
      return {
        index,
        header: headers[index],
        source: "fallback",
      };
    }
  }

  return null;
}

function resolveColumnDetection(
  headers: string[],
  llamaResponse: LlamaCsvResponse | null
): CsvColumnDetection | null {
  if (!headers.length) return null;
  const normalizedHeaders = headers.map((header) => normalizeHeaderName(header));

  const monthMatch = matchColumn(llamaResponse?.month_column, MONTH_KEYWORDS, headers, normalizedHeaders);
  const quantityMatch = matchColumn(llamaResponse?.quantity_column, QUANTITY_KEYWORDS, headers, normalizedHeaders);

  if (!monthMatch || !quantityMatch) {
    return null;
  }

  return {
    monthIndex: monthMatch.index,
    quantityIndex: quantityMatch.index,
    monthHeader: monthMatch.header,
    quantityHeader: quantityMatch.header,
    source: monthMatch.source === "llama" && quantityMatch.source === "llama" ? "llama" : "fallback",
  };
}

async function detectHistoricalColumnsWithLlama(
  headers: string[],
  sampleRows: string[][]
): Promise<LlamaCsvResponse | null> {
  if (!headers.length) return null;
  const snippet =
    sampleRows.length > 0
      ? sampleRows
          .slice(0, 5)
          .map((row, index) => `${index + 1}. ${JSON.stringify(row)}`)
          .join("\n")
      : "No sample rows available.";

  const prompt = `You are helping map CSV headers to the fields required by a retail demand forecasting model.

Headers: ${JSON.stringify(headers)}
Sample rows:
${snippet}

Return JSON ONLY with keys "month_column" and "quantity_column" that contain the exact header names for the month/date column and the units/quantity column. Use null if a column is missing.`;

  const content = await callLlama(prompt, { maxTokens: 180 });
  if (!content) {
    return null;
  }

  try {
    const jsonCandidate = content.trim().startsWith("{")
      ? content.trim()
      : content.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonCandidate) {
      console.error("[CSV LLM] Response did not contain JSON");
      return null;
    }
    const parsed = JSON.parse(jsonCandidate) as LlamaCsvResponse;
    console.log("[CSV LLM] Parsed:", parsed);
    return parsed;
  } catch (error) {
    console.error("[CSV LLM] Failed to parse JSON:", error);
    return null;
  }
}

function normalizeMonthValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}\/\d{2}$/.test(trimmed)) return `${trimmed.slice(0, 4)}-${trimmed.slice(5).padStart(2, "0")}`;
  if (/^\d{4}\.\d{2}$/.test(trimmed)) return `${trimmed.slice(0, 4)}-${trimmed.slice(5).padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || /^\d{4}\/\d{2}\/\d{2}$/.test(trimmed) || /^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(5, 7)}`;
  }
  if (/^\d{2}[-/]\d{4}$/.test(trimmed)) {
    const [month, year] = trimmed.split(/[-/]/);
    return `${year}-${month.padStart(2, "0")}`;
  }
  if (/^\d{6}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4).padStart(2, "0")}`;
  }
  if (/^[A-Za-z]{3}[-\s]\d{4}$/.test(trimmed)) {
    const [monthName, year] = trimmed.replace("-", " ").split(" ");
    const parsed = new Date(`${monthName} 1, ${year}`);
    if (!Number.isNaN(parsed.valueOf())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.valueOf())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

function parseQuantityValue(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/\s+/g, "");
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  const normalized =
    hasComma && hasDot
      ? cleaned.replace(/,/g, "")
      : hasComma && !hasDot
      ? cleaned.replace(/,/g, ".")
      : cleaned;
  const numeric = Number.parseFloat(normalized.replace(/[^0-9.+-]/g, ""));
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return 0;
}

function nextMonthLabel(label: string): string {
  const [yearStr, monthStr] = label.split("-");
  let year = Number.parseInt(yearStr, 10);
  let month = Number.parseInt(monthStr, 10);
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`;
}

function buildNormalizedHistory(rows: string[][], detection: CsvColumnDetection): string[] {
  const requiredLength = Math.max(detection.monthIndex, detection.quantityIndex) + 1;
  const aggregated = new Map<string, number>();

  for (const rawRow of rows) {
    const row = [...rawRow];
    if (row.length < requiredLength) {
      row.length = requiredLength;
    }
    const monthLabel = normalizeMonthValue(row[detection.monthIndex]);
    if (!monthLabel) continue;
    const quantity = parseQuantityValue(row[detection.quantityIndex]);
    aggregated.set(monthLabel, (aggregated.get(monthLabel) ?? 0) + quantity);
  }

  if (!aggregated.size) {
    return [];
  }

  const months = Array.from(aggregated.keys()).sort();
  const start = months[0];
  const end = months[months.length - 1];
  const result: string[] = [];

  let cursor = start;
  while (true) {
    const qty = aggregated.get(cursor) ?? 0;
    result.push(`${cursor},${qty}`);
    if (cursor === end) break;
    cursor = nextMonthLabel(cursor);
  }

  return result;
}

async function normalizeHistoricalCsv(content: string | null | undefined): Promise<CsvNormalizationResult | null> {
  if (!content) return null;
  const decoded = decodeCsvBase64(content);
  if (!decoded) return null;

  const parsed = parseCsv(decoded);
  if (!parsed.headers.length) return null;

  const llamaResponse = await detectHistoricalColumnsWithLlama(parsed.headers, parsed.rows.slice(0, 5));
  const detection = resolveColumnDetection(parsed.headers, llamaResponse);

  if (!detection) {
    console.warn("[CSV] Unable to map columns, keeping original content");
    return { content };
  }

  const normalizedRows = buildNormalizedHistory(parsed.rows, detection);
  if (!normalizedRows.length) {
    console.warn("[CSV] Column mapping produced no rows, keeping original content");
    return { content };
  }

  const csv = ["month,qty", ...normalizedRows].join("\n");
  const base64 = Buffer.from(csv, "utf8").toString("base64");
  const normalizedContent = `data:text/csv;base64,${base64}`;

  const note = `CSV columns mapped (${detection.source === "llama" ? "LLM" : "fallback"}): ${detection.monthHeader}→month, ${detection.quantityHeader}→qty`;
  return {
    content: normalizedContent,
    note,
    detection,
  };
}

async function runPythonInference(payload: ForecastRequest) {
  return new Promise<PythonForecastResponse>((resolve, reject) => {
    const python = spawn("python3", ["python/infer.py"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(stderr || `Python exited with status ${code ?? "unknown"}`)
        );
      }

      try {
        const parsed = JSON.parse(stdout || "{}");
        resolve(parsed as PythonForecastResponse);
      } catch {
        reject(new Error(`Failed to parse python output: ${stdout}`));
      }
    });

    python.on("error", (error) => {
      reject(error);
    });

    python.stdin.write(JSON.stringify(payload));
    python.stdin.end();
  });
}

async function persistForecast(
  payload: ForecastRequest,
  result: ForecastResponse,
  normalizedProduct: ForecastRequest["product"],
  warning?: string | null
) {
  const supabaseReady = isSupabaseConfigured("service");
  const timestamp = new Date().toISOString();
  let forecastId = randomUUID();

  if (supabaseReady) {
    try {
      const supabase = createSupabaseServiceClient();

      let productId: string | null = null;

      // Check if product exists by SKU (if provided and not empty)
      if (normalizedProduct.sku && normalizedProduct.sku.trim()) {
        const existing = await supabase
          .from("products")
          .select("id")
          .eq("sku", normalizedProduct.sku)
          .maybeSingle();

        if (existing.data?.id) {
          productId = existing.data.id;
          await supabase
            .from("products")
            .update({
              title: normalizedProduct.title ?? null,
              category: normalizedProduct.category,
              color: normalizedProduct.color,
              sizes: normalizedProduct.sizes,
              cost: normalizedProduct.cost,
              first_sale_month: normalizedProduct.first_sale_month,
              image_url: payload.imageUrl ?? null,
            })
            .eq("id", productId);
        }
      }

      // Always create product if not found (even without SKU)
      if (!productId) {
        const inserted = await supabase
          .from("products")
          .insert({
            sku: normalizedProduct.sku && normalizedProduct.sku.trim() ? normalizedProduct.sku : null,
            title: normalizedProduct.title ?? null,
            category: normalizedProduct.category,
            color: normalizedProduct.color,
            sizes: normalizedProduct.sizes,
            cost: normalizedProduct.cost,
            first_sale_month: normalizedProduct.first_sale_month,
            image_url: payload.imageUrl ?? null,
          })
          .select("id")
          .single();

        if (inserted.error) {
          console.error("Failed to create product:", inserted.error);
          throw new Error(`Product creation failed: ${inserted.error.message}`);
        }

        productId = inserted.data?.id ?? null;
      }

      if (!productId) {
        throw new Error("Failed to get product_id");
      }

      const params = {
        product: normalizedProduct,
        model: result.model,
        salesCsvUrl: payload.salesCsvUrl ?? null,
        imageUrl: payload.imageUrl ?? null,
        warning: warning ?? result.warning ?? null,
        months: result.months ?? [],
      };

      const insertedForecast = await supabase
        .from("forecasts")
        .insert({
          product_id: productId,
          model_name: result.model,
          horizon: result.horizon,
          params,
          y_true: result.y_true ?? null,
          y_pred: result.y_pred ?? [],
          created_at: timestamp,
        })
        .select("id")
        .single();

      if (insertedForecast.error) {
        console.warn("Failed to insert forecast", insertedForecast.error);
      } else if (insertedForecast.data?.id) {
        forecastId = insertedForecast.data.id;
      }
    } catch (error) {
      console.error("Supabase persistence error", error);
    }
  } else {
    await fs.mkdir(LOCAL_FORECAST_DIR, { recursive: true });
    const record = {
      id: forecastId,
      product: normalizedProduct,
      model_name: result.model,
      horizon: result.horizon,
      params: {
        product: normalizedProduct,
        model: result.model,
        salesCsvUrl: payload.salesCsvUrl ?? null,
        imageUrl: payload.imageUrl ?? null,
        warning: warning ?? result.warning ?? null,
        months: result.months ?? [],
      },
      y_true: result.y_true ?? null,
      y_pred: result.y_pred ?? [],
      months: result.months ?? [],
      created_at: timestamp,
    };

    await fs.writeFile(
      path.join(LOCAL_FORECAST_DIR, `${forecastId}.json`),
      JSON.stringify(record, null, 2),
      "utf8"
    );
  }

  return forecastId;
}

export async function POST(request: Request) {
  try {
    console.log("[Forecast API] Received request");
    const raw = await request.json();
    console.log("[Forecast API] Payload:", JSON.stringify(raw, null, 2));
    const parsed = forecastRequestSchema.parse(raw);

    // Validate and normalize with Llama 3.3 70B
    const validation = await validateWithLlama(parsed.product);
    
    let productToUse = { ...parsed.product };
    
    if (validation.correctedProduct) {
      console.log("[Forecast] LLM corrected:", validation.correctedProduct);
      productToUse = {
        ...productToUse,
        ...validation.correctedProduct,
      };
    } else {
      console.log("[Forecast] LLM failed, using fallback normalization");
      
      // Fallback: Always uppercase category and color
      productToUse.category = (productToUse.category || "").toString().toUpperCase().trim();
      productToUse.color = (productToUse.color || "").toString().toUpperCase().trim();
      productToUse.sizes = (productToUse.sizes || "").toString().toUpperCase().trim();
      
      // Map common category variations as fallback
      const categoryMap: Record<string, string> = {
        "CHILD": "CHILDREN",
        "KIDS": "CHILDREN",
        "KID": "CHILDREN",
        "BABY": "CHILDREN",
        "TODDLER": "CHILDREN",
        "MEN": "MASCULINE",
        "MENS": "MASCULINE",
        "MALE": "MASCULINE",
        "MAN": "MASCULINE",
        "MENSWEAR": "MASCULINE",
        "BOYS": "MASCULINE",
        "WOMEN": "FEMININE",
        "WOMENS": "FEMININE",
        "FEMALE": "FEMININE",
        "WOMAN": "FEMININE",
        "LADIES": "FEMININE",
        "GIRLS": "FEMININE",
        "MUSCULINE": "MASCULINE",
        "MASCULIN": "MASCULINE",
        "FEMININ": "FEMININE",
      };
      
      if (categoryMap[productToUse.category]) {
        productToUse.category = categoryMap[productToUse.category];
      }
    }
    
    console.log("[Forecast] Final product:", {
      category: productToUse.category,
      color: productToUse.color,
      sizes: productToUse.sizes,
      cost: productToUse.cost
    });

    const normalizedProduct = {
      ...productToUse,
      category: sanitizeText(productToUse.category),
      color: sanitizeText(productToUse.color),
      sizes: sanitizeText(productToUse.sizes),
      first_sale_month: productToUse.first_sale_month.includes("-")
        ? `${productToUse.first_sale_month.slice(0, 7)}-01`
        : productToUse.first_sale_month,
    };

    if (normalizedProduct.cost <= 0) {
      normalizedProduct.cost = 1;
    }

    const csvNotes: string[] = [];
    const originalHasSalesHistory = Boolean(parsed.salesCsvUrl) || Boolean(parsed.salesCsvContent);
    let salesCsvContent = parsed.salesCsvContent ?? null;

    if (originalHasSalesHistory) {
      if (!salesCsvContent && parsed.salesCsvUrl) {
        try {
          const response = await fetch(parsed.salesCsvUrl);
          if (response.ok) {
            const text = await response.text();
            salesCsvContent = `data:text/csv;base64,${Buffer.from(text, "utf8").toString("base64")}`;
          } else {
            csvNotes.push("Uploaded CSV could not be downloaded; using fallback defaults.");
            console.warn("[Forecast] Failed to download CSV:", response.status, parsed.salesCsvUrl);
          }
        } catch (error) {
          csvNotes.push("Uploaded CSV could not be downloaded; using fallback defaults.");
          console.warn("[Forecast] CSV fetch error:", error);
        }
      }

      try {
        const normalizedCsv = await normalizeHistoricalCsv(salesCsvContent);
        if (normalizedCsv) {
          salesCsvContent = normalizedCsv.content;
          if (normalizedCsv.note) {
            csvNotes.push(normalizedCsv.note);
          }
        } else if (salesCsvContent) {
          csvNotes.push("CSV headers could not be mapped automatically; continuing with uploaded columns.");
        }
      } catch (error) {
        csvNotes.push("CSV analysis failed; continuing with uploaded data.");
        console.warn("[Forecast] CSV normalization error:", error);
      }
    }

    const hasSalesHistory = Boolean(salesCsvContent);
    const resolvedModel: ForecastRequest["model"] = hasSalesHistory ? "lgbm_full" : "lgbm_meta";

    const pythonPayload: ForecastRequest = {
      ...parsed,
      model: resolvedModel,
      product: normalizedProduct,
      salesCsvContent: salesCsvContent,
    };

    const pythonResult = await runPythonInference(pythonPayload);

    if (pythonResult.error && !pythonResult.y_pred) {
      return NextResponse.json(pythonResult, { status: 400 });
    }

    const warningMessages = [...csvNotes, pythonResult.warning]
      .filter((message): message is string => Boolean(message && message.trim()))
      .join(" · ")
      .trim();

    // Remove metrics field if present (we don't use it anymore)
    const { metrics: _unusedMetrics, ...resultWithoutMetrics } = pythonResult;
    void _unusedMetrics;

    const resultPayload = {
      ...resultWithoutMetrics,
      model: pythonPayload.model,
      warning: warningMessages || undefined,
    };

    const validated = forecastResponseSchema.parse(resultPayload);

    const forecastId = await persistForecast(
      pythonPayload,
      validated,
      normalizedProduct,
      warningMessages || undefined
    );

    console.log("[Forecast API] Success! ForecastId:", forecastId);

    return NextResponse.json(
      {
        ...validated,
        forecastId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forecast API error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 }
    );
  }
}
