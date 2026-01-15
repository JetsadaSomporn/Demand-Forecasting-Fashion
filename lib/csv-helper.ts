import { callLlama } from "@/lib/llm";

export type SupportedLanguage = "en" | "th";

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

export function getCsvNote(key: keyof typeof CSV_NOTE_MESSAGES, language: SupportedLanguage) {
  return CSV_NOTE_MESSAGES[key][language] ?? CSV_NOTE_MESSAGES[key].en;
}

export function getMappingNote(
  detection: CsvColumnDetection,
  language: SupportedLanguage
) {
  const sourceLabel = CSV_SOURCE_LABEL[detection.source]?.[language] ?? CSV_SOURCE_LABEL.llama[language];
  if (language === "th") {
    return `แมปคอลัมน์เรียบร้อย (${sourceLabel}) ${detection.monthHeader} → month, ${detection.quantityHeader} → qty`;
  }
  return `CSV columns mapped (${sourceLabel}): ${detection.monthHeader} → month, ${detection.quantityHeader} → qty`;
}

type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

export type CsvColumnDetection = {
  monthIndex: number;
  quantityIndex: number;
  monthHeader: string;
  quantityHeader: string;
  source: "llama" | "fallback";
};

export type CsvNormalizationResult = {
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

export async function normalizeHistoricalCsv(
  content: string | null | undefined,
  language: SupportedLanguage
): Promise<CsvNormalizationResult | null> {
  if (!content) return null;
  const decoded = decodeCsvBase64(content);
  if (!decoded) return null;

  const parsed = parseCsv(decoded);
  if (!parsed.headers.length) return null;

  // Optimization: Try heuristic detection first to avoid unnecessary LLM calls
  let detection = resolveColumnDetection(parsed.headers, null);

  if (!detection) {
    const llamaResponse = await detectHistoricalColumnsWithLlama(parsed.headers, parsed.rows.slice(0, 5));
    detection = resolveColumnDetection(parsed.headers, llamaResponse);
  }

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
