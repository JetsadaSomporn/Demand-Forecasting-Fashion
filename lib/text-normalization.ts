import { ForecastRequest } from "@/lib/validators";

export const THAI_CATEGORY_KEYWORDS: Record<string, string[]> = {
  FEMININE: ["ผู้หญิง", "สุภาพสตรี", "หญิง", "สาว", "เลดี้", "ผู้หญิงสาว"],
  MASCULINE: ["ผู้ชาย", "สุภาพบุรุษ", "ชาย", "หนุ่ม", "บุรุษ", "แมน"],
  CHILDREN: ["เด็ก", "เด็กชาย", "เด็กหญิง", "เด็กๆ", "เด็กน้อย", "วัยรุ่น"],
};

export const THAI_COLOR_KEYWORDS: Record<string, string[]> = {
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

export const THAI_SIZE_KEYWORDS: Record<string, string[]> = {
  "S|M|L|XL": ["ฟรีไซส์", "ฟรีไซซ์", "free size", "freesize", "free-size"],
  "XS|S|M|L|XL": ["ครบไซส์", "ทุกไซส์"],
};

export const CATEGORY_MAP: Record<string, string> = {
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

export function sanitizeText(value: string | null | undefined) {
  if (!value) return "__NA__";
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "__NA__";
}

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

export function translateThaiProduct(product: ForecastRequest["product"]) {
  return {
    ...product,
    category: translateThaiCategory(product.category),
    color: translateThaiColor(product.color),
    sizes: translateThaiSizes(product.sizes),
  };
}
