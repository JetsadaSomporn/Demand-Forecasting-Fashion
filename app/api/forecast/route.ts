import { NextResponse } from "next/server";
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
import { callLlama } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const extendedForecastRequestSchema = forecastRequestSchema.extend({
  externalResult: forecastResponseSchema.optional(),
});

type SupportedLanguage = "en" | "th";

const CSV_NOTE_MESSAGES: Record<
  "downloadFailed" | "mappingFallback" | "analysisFailed",
  Record<SupportedLanguage, string>
> = {
  downloadFailed: {
    en: "Uploaded CSV could not be downloaded; using fallback defaults.",
    th: "ไม่สามารถดาวน์โหลดไฟล์ CSV ได้ ระบบจะใช้ข้อมูลเดิมแทน",
  },
  mappingFallback: {
    en: "CSV headers could not be mapped automatically; continuing with uploaded columns.",
    th: "ไม่สามารถแมปคอลัมน์ CSV อัตโนมัติได้ จะใช้คอลัมน์ตามไฟล์ที่อัปโหลด",
  },
  analysisFailed: {
    en: "CSV analysis failed; continuing with uploaded data.",
    th: "การวิเคราะห์ CSV ล้มเหลว จะใช้ข้อมูลที่อัปโหลดต่อ",
  },
};

const CSV_SOURCE_LABEL: Record<"llama" | "fallback", Record<SupportedLanguage, string>> = {
  llama: {
    en: "LLM",
    th: "LLM",
  },
  fallback: {
    en: "rule-based",
    th: "ตรรกะตั้งต้น",
  },
};

function getCsvNote(key: keyof typeof CSV_NOTE_MESSAGES, language: SupportedLanguage) {
  return CSV_NOTE_MESSAGES[key][language] ?? CSV_NOTE_MESSAGES[key].en;
}

function getMappingNote(
  detection: CsvColumnDetection,
  language: SupportedLanguage
) {
  const sourceLabel = CSV_SOURCE_LABEL[detection.source]?.[language] ?? CSV_SOURCE_LABEL.llama[language];
  if (language === "th") {
    return `แมปคอลัมน์เรียบร้อย (${sourceLabel}) ${detection.monthHeader} → month, ${detection.quantityHeader} → qty`;
  }
  return `CSV columns mapped (${sourceLabel}): ${detection.monthHeader} → month, ${detection.quantityHeader} → qty`;
}

const LOCAL_FORECAST_DIR = path.join(process.cwd(), ".data/forecasts");
const FORECAST_SERVICE_URL = process.env.FORECAST_SERVICE_URL;
const FORECAST_SERVICE_TOKEN = process.env.FORECAST_SERVICE_TOKEN;

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

function sanitizeText(value: string | null | undefined) {
  if (!value) return "__NA__";
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "__NA__";
}

const THAI_CATEGORY_KEYWORDS: Record<string, string[]> = {
  FEMININE: ["ผู้หญิง", "สุภาพสตรี", "หญิง", "สาว", "เลดี้", "ผู้หญิงสาว"],
  MASCULINE: ["ผู้ชาย", "สุภาพบุรุษ", "ชาย", "หนุ่ม", "บุรุษ", "แมน"],
  CHILDREN: ["เด็ก", "เด็กชาย", "เด็กหญิง", "เด็กๆ", "เด็กน้อย", "วัยรุ่น"],
};

const THAI_COLOR_KEYWORDS: Record<string, string[]> = {
  BLACK: ["ดำ", "ดํา", "สีดำ", "สีดํา", "ดำสนิท", "สีดำสนิท"],
  WHITE: ["ขาว", "สีขาว", "ขาวล้วน", "สีขาวล้วน"],
  BLUE: ["น้ำเงิน", "สีน้ำเงิน", "ฟ้า", "สีฟ้า", "คราม", "สีคราม", "บลู"],
  RED: ["แดง", "สีแดง", "แดงสด", "สีแดงสด", "เรด"],
  GREEN: ["เขียว", "สีเขียว", "กรีน"],
  PINK: ["ชมพู", "สีชมพู", "พิ้งค์"],
  PURPLE: ["ม่วง", "สีม่วง", "ม่วงลาเวนเดอร์", "สีม่วงลาเวนเดอร์"],
  BEIGE: ["เบจ", "สีเบจ", "ครีม", "สีครีม", "นู้ด", "สีนู้ด"],
  GRAY: ["เทา", "สีเทา", "เทาอ่อน", "สีเทาอ่อน", "เทาเข้ม", "สีเทาเข้ม", "เกรย์"],
  BROWN: ["น้ำตาล", "สีน้ำตาล", "บราวน์"],
};

const THAI_SIZE_KEYWORDS: Record<string, string[]> = {
  "S|M|L|XL": ["ฟรีไซส์", "ฟรีไซซ์", "free size", "freesize", "free-size"],
  "XS|S|M|L|XL": ["ครบไซส์", "ทุกไซส์"],
};

function normalizeThaiText(value: string | null | undefined) {
  if (!value) return "";
  return value.toString().trim().toLowerCase();
}

function translateThaiCategory(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.toString().trim();
  if (!trimmed) return "";
  const normalized = normalizeThaiText(trimmed);
  for (const [mapped, keywords] of Object.entries(THAI_CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return mapped;
    }
  }
  if (["feminine", "masculine", "children"].includes(normalized)) {
    return normalized.toUpperCase();
  }
  return trimmed;
}

function translateThaiColor(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.toString().trim();
  if (!trimmed) return "";
  const normalized = normalizeThaiText(trimmed);
  const condensed = normalized.replace(/\s+/g, "");
  for (const [mapped, keywords] of Object.entries(THAI_COLOR_KEYWORDS)) {
    if (
      keywords.some(
        (keyword) => normalized.includes(keyword) || condensed.includes(keyword.replace(/\s+/g, ""))
      )
    ) {
      return mapped;
    }
  }
  const upper = trimmed.toUpperCase();
  if (THAI_COLOR_KEYWORDS[upper as keyof typeof THAI_COLOR_KEYWORDS]) {
    return upper;
  }
  switch (upper) {
    case "BLACK":
    case "WHITE":
    case "BLUE":
    case "RED":
    case "GREEN":
    case "PINK":
    case "PURPLE":
    case "BEIGE":
    case "GRAY":
    case "GREY":
    case "BROWN":
      return upper === "GREY" ? "GRAY" : upper;
    default:
      return upper;
  }
}

function translateThaiSizes(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.toString().trim();
  if (!trimmed) return "";
  const normalized = normalizeThaiText(trimmed);
  for (const [mapped, keywords] of Object.entries(THAI_SIZE_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return mapped;
    }
  }
  const upper = trimmed.toUpperCase();
  if (upper.includes("|")) {
    return upper;
  }
  const tokens = upper
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const allowedSizes = new Set(["XS", "S", "M", "L", "XL", "XXL"]);
  if (tokens.length && tokens.every((token) => allowedSizes.has(token))) {
    return tokens.join("|");
  }
  return upper;
}

function translateThaiProduct(product: ForecastRequest["product"]) {
  return {
    ...product,
    category: translateThaiCategory(product.category),
    color: translateThaiColor(product.color),
    sizes: translateThaiSizes(product.sizes),
  };
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

async function normalizeHistoricalCsv(
  content: string | null | undefined,
  language: SupportedLanguage
): Promise<CsvNormalizationResult | null> {
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

  const note = getMappingNote(detection, language);
  return {
    content: normalizedContent,
    note,
    detection,
  };
}

async function runRemoteInference(payload: ForecastRequest): Promise<PythonForecastResponse> {
  if (!FORECAST_SERVICE_URL) {
    throw new Error("FORECAST_SERVICE_URL environment variable is not configured");
  }

  const baseUrl = FORECAST_SERVICE_URL.replace(/\/+$/, "");
  const invokeUrl = `${baseUrl}/gradio_api/call/predict`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (FORECAST_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${FORECAST_SERVICE_TOKEN}`;
  }

  const body = JSON.stringify({ data: [JSON.stringify(payload)] });

  const response = await fetch(invokeUrl, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Forecast service error: ${rawText || response.statusText}`);
  }

  let startPayload: unknown;
  try {
    startPayload = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    throw new Error(
      `Forecast service returned invalid JSON (${(error as Error).message}): ${rawText.slice(0, 200)}`
    );
  }

  const eventId =
    typeof startPayload === "object" &&
    startPayload &&
    "event_id" in startPayload &&
    typeof (startPayload as { event_id: unknown }).event_id === "string"
      ? ((startPayload as { event_id: string }).event_id ?? "").trim()
      : "";

  if (!eventId) {
    throw new Error("Forecast service did not return an event_id");
  }

  const eventStreamUrl = `${invokeUrl}/${eventId}`;

  const eventResponse = await fetch(eventStreamUrl, {
    method: "GET",
    headers: {
      ...(FORECAST_SERVICE_TOKEN ? { Authorization: `Bearer ${FORECAST_SERVICE_TOKEN}` } : {}),
      Accept: "text/event-stream",
    },
  });

  if (!eventResponse.ok || !eventResponse.body) {
    const text = await eventResponse.text().catch(() => "");
    throw new Error(`Forecast service stream error: ${text || eventResponse.statusText}`);
  }

  const reader = eventResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const chunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      let eventType = "message";
      const dataParts: string[] = [];

      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataParts.push(line.slice(5).trim());
        }
      }

      const dataString = dataParts.join("\n");

      if (eventType === "complete") {
        if (!dataString) {
          throw new Error("Forecast service returned an empty completion payload");
        }

        let parsedResult: unknown;
        try {
          parsedResult = JSON.parse(dataString);
        } catch (error) {
          throw new Error(
            `Forecast service returned invalid completion JSON (${(error as Error).message}): ${dataString.slice(0, 200)}`
          );
        }

        const resultCandidate = Array.isArray(parsedResult) ? parsedResult[0] : parsedResult;

        if (!resultCandidate || typeof resultCandidate !== "object") {
          throw new Error("Forecast service completion payload is empty");
        }

        return resultCandidate as PythonForecastResponse;
      }

      if (eventType === "error") {
        throw new Error(dataString || "Forecast service reported an error");
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  throw new Error("Forecast service stream ended before returning a result");
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
        yPred: result.y_pred ?? [],
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
          summary: null,
          summary_language: null,
          summary_created_at: null,
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
        yPred: result.y_pred ?? [],
      },
      y_true: result.y_true ?? null,
      y_pred: result.y_pred ?? [],
      months: result.months ?? [],
      created_at: timestamp,
      summary: null,
      summary_language: null,
      summary_created_at: null,
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
    const extendedParsed = extendedForecastRequestSchema.parse(raw);
    const { externalResult, ...parsedWithoutExternal } = extendedParsed;
    const parsed = parsedWithoutExternal as ForecastRequest;
    const requestLanguage: SupportedLanguage = parsed.language === "th" ? "th" : "en";
    const productWithThaiNormalization = translateThaiProduct(parsed.product);

    const validation = await validateWithLlama(productWithThaiNormalization);
    
    let productToUse = { ...productWithThaiNormalization };
    
    if (validation.correctedProduct) {
      console.log("[Forecast] LLM corrected:", validation.correctedProduct);
      productToUse = {
        ...productToUse,
        ...validation.correctedProduct,
      };
    } else {
      console.log("[Forecast] LLM failed, using fallback normalization");
      
      productToUse.category = (productToUse.category || "").toString().toUpperCase().trim();
      productToUse.color = (productToUse.color || "").toString().toUpperCase().trim();
      productToUse.sizes = (productToUse.sizes || "").toString().toUpperCase().trim();
      
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
            csvNotes.push(getCsvNote("downloadFailed", requestLanguage));
            console.warn("[Forecast] Failed to download CSV:", response.status, parsed.salesCsvUrl);
          }
        } catch (error) {
          csvNotes.push(getCsvNote("downloadFailed", requestLanguage));
          console.warn("[Forecast] CSV fetch error:", error);
        }
      }

      try {
        const normalizedCsv = await normalizeHistoricalCsv(salesCsvContent, requestLanguage);
        if (normalizedCsv) {
          salesCsvContent = normalizedCsv.content;
          if (normalizedCsv.note) {
            csvNotes.push(normalizedCsv.note);
          }
        } else if (salesCsvContent) {
          csvNotes.push(getCsvNote("mappingFallback", requestLanguage));
        }
      } catch (error) {
        csvNotes.push(getCsvNote("analysisFailed", requestLanguage));
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

    const pythonResult =
      externalResult != null
        ? externalResult
        : await runRemoteInference(pythonPayload);

    if ("error" in pythonResult && pythonResult.error && !pythonResult.y_pred) {
      return NextResponse.json(pythonResult as unknown as Record<string, unknown>, {
        status: 400,
      });
    }

    const warningMessages = [...csvNotes, pythonResult.warning]
      .filter((message): message is string => Boolean(message && message.trim()))
      .join(" · ")
      .trim();

    const baseResult =
      "metrics" in pythonResult
        ? (({ metrics: _unusedMetrics, ...rest }) => {
            void _unusedMetrics;
            return rest;
          })(pythonResult as PythonForecastResponse)
        : pythonResult;

    const resultPayload = {
      ...(baseResult as ForecastResponse),
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
