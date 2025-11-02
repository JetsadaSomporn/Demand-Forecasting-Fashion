import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { imageExtractSchema } from "@/lib/validators";

const COLOR_KEYWORDS: Record<string, string[]> = {
  Black: ["black", "noir", "ebony", "ink", "jet"],
  White: ["white", "ivory", "cream", "snow", "pearl"],
  Beige: ["beige", "sand", "khaki", "taupe", "tan"],
  Blue: ["blue", "navy", "cobalt", "azure", "teal", "denim"],
  Red: ["red", "crimson", "scarlet", "ruby", "burgundy"],
  Green: ["green", "emerald", "sage", "olive", "mint"],
  Pink: ["pink", "blush", "rose", "magenta", "fuchsia"],
  Purple: ["purple", "violet", "lavender", "lilac"],
  Brown: ["brown", "cocoa", "mocha", "chocolate", "espresso"],
  Gray: ["gray", "grey", "slate", "ash", "charcoal", "silver"],
  Yellow: ["yellow", "gold", "mustard", "amber", "ochre", "ocher"],
  Orange: ["orange", "rust", "terracotta", "coral", "apricot"],
};

const COLOR_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_KEYWORDS).flatMap(([canonical, variants]) => [
    [canonical.toUpperCase(), canonical.toUpperCase()],
    ...variants.map((variant) => [variant.toUpperCase(), canonical.toUpperCase()]),
  ])
);

COLOR_ALIASES.GRAY = "GRAY";
COLOR_ALIASES.GREY = "GRAY";
COLOR_ALIASES.SILVER = "GRAY";
COLOR_ALIASES.CREAM = "BEIGE";
COLOR_ALIASES.CARAMEL = "BROWN";
COLOR_ALIASES.TAN = "BEIGE";
COLOR_ALIASES.KHAKI = "BEIGE";
COLOR_ALIASES.NEUTRAL = "BEIGE";
COLOR_ALIASES.MULTICOLOR = "MULTICOLOR";

const DEFAULT_COLOR = "BLACK";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";
const DATA_URL_REGEX =
  /^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/i;

function extensionFromMime(mime: string) {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return null;
  }
}

function normalizeColor(input: string | null | undefined) {
  if (!input) return DEFAULT_COLOR;
  const cleaned = input.trim().toUpperCase();
  if (!cleaned) return DEFAULT_COLOR;

  if (COLOR_ALIASES[cleaned]) {
    return COLOR_ALIASES[cleaned];
  }

  const tokens = cleaned.split(/[\s/-]+/);
  for (const token of tokens) {
    if (COLOR_ALIASES[token]) {
      return COLOR_ALIASES[token];
    }
  }

  // Allow hex-like colors (e.g., "#fefefe") to map to closest known shade
  if (/^#?[0-9A-F]{6}$/.test(cleaned)) {
    const hex = cleaned.startsWith("#") ? cleaned.slice(1) : cleaned;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;

    if (max === min) {
      return lightness > 200 ? "WHITE" : lightness < 55 ? "BLACK" : "GRAY";
    }

    if (max === r && g >= b) return "ORANGE";
    if (max === r && g < b) return "RED";
    if (max === g) return lightness > 80 ? "YELLOW" : "GREEN";
    return "BLUE";
  }

  return DEFAULT_COLOR;
}

async function prepareImageForGemini(source: string) {
  if (!source) {
    throw new Error("No image source provided for Gemini analysis.");
  }

  const trimmedSource = source.trim();

  // Handle data URL (base64)
  if (trimmedSource.startsWith("data:")) {
    const match = DATA_URL_REGEX.exec(trimmedSource);
    if (!match?.[1] || !match?.[2]) {
      throw new Error("Invalid data URL provided for image analysis.");
    }

    const mime = match[1];
    const base64 = match[2];
    const extension = extensionFromMime(mime);
    if (!extension) {
      throw new Error(`Unsupported image MIME type: ${mime}`);
    }

    return { mimeType: mime, base64Data: base64 };
  }

  // Handle remote URL - fetch and convert to base64
  try {
    if (!/^https?:\/\//i.test(trimmedSource)) {
      throw new Error("Unsupported image source format provided.");
    }

    const response = await fetch(trimmedSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch image (${response.status} ${response.statusText})`);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!extensionFromMime(contentType)) {
      throw new Error(`Unsupported image MIME type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      mimeType: contentType,
      base64Data: buffer.toString("base64"),
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Unable to fetch image for Gemini analysis: ${error.message}`
        : "Unable to fetch image for Gemini analysis"
    );
  }
}

function heuristicFromFilename(source: string | null | undefined) {
  if (!source) {
    return {
      category: "Feminine",
      color: DEFAULT_COLOR,
      sizes: "S|M|L|XL",
      style: "Minimal silhouette",
      confidence: 0.2,
      hint: "No image provided; returning default suggestion.",
    };
  }

  const lower = source.toLowerCase();
  let category = "Feminine";
  if (lower.includes("men") || lower.includes("male") || lower.includes("masculine")) {
    category = "Masculine";
  } else if (lower.includes("kid") || lower.includes("child") || lower.includes("baby")) {
    category = "Children";
  } else if (lower.includes("women") || lower.includes("female") || lower.includes("feminine") || 
             lower.includes("dress") || lower.includes("skirt")) {
    category = "Feminine";
  }
  
  for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return {
        category,
        color: color.toUpperCase(),
        sizes: "S|M|L|XL",
        style: `${color} fashion item`,
        confidence: 0.3,
        hint: "Derived from filename keywords.",
      };
    }
  }

  return {
    category,
    color: DEFAULT_COLOR,
    sizes: "S|M|L|XL",
    style: "Contemporary minimal",
    confidence: 0.25,
    hint: "No color keywords detected; defaulting to minimal styling.",
  };
}

async function analyzeImageWithGemini(
  image: { mimeType: string; base64Data: string },
  apiKey: string
) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const prompt = `Analyze this fashion item image carefully and extract the following information:

1. **Category**: Classify as one of:
   - "Feminine" (women's clothing, dresses, skirts, feminine styles)
   - "Masculine" (men's clothing, suits, masculine styles)
   - "Children" (kids' clothing)

2. **Color**: Identify the PRIMARY/DOMINANT color of the garment. Be precise and choose ONE color from this list:
   - YELLOW (for bright yellow, golden yellow, mustard)
   - ORANGE (for orange, tangerine, coral)
   - RED (for red, crimson, scarlet)
   - PINK (for pink, rose, magenta)
   - PURPLE (for purple, violet, lavender)
   - BLUE (for blue, navy, azure, denim)
   - GREEN (for green, emerald, olive, mint)
   - BROWN (for dark brown, chocolate, coffee - NOT for yellow or tan)
   - BEIGE (for beige, tan, sand, cream, khaki - light neutral tones)
   - GRAY (for gray, silver, charcoal)
   - BLACK (for black, dark tones)
   - WHITE (for white, off-white, ivory)
   
   IMPORTANT: 
   - If it's bright YELLOW, answer "YELLOW" not BROWN or BEIGE
   - If it's light TAN or CREAM, answer "BEIGE" not BROWN
   - Only use BROWN for actual dark brown colors
   - Focus on the MAIN color, ignore small patterns or accents

3. **Sizes**: Available sizes in pipe-separated format. Common patterns:
   - "S|M|L|XL" (standard)
   - "XS|S|M|L|XL" (extended)
   - "M|L" (limited)
   - "S|M|L" (basic)
   If unclear, use "S|M|L|XL" as default.

4. **Style**: Provide a specific, descriptive product title that accurately describes the garment. Include:
   - Garment type (T-shirt, Dress, Jacket, Pants, Skirt, Sweater, etc.)
   - Key style features (Casual, Formal, Vintage, Modern, Oversized, Fitted, etc.)
   - Notable details (V-neck, Button-down, Striped, Pleated, Hooded, etc.)
   
   Examples:
   - "Casual Cotton T-Shirt"
   - "Formal Button-Down Shirt"
   - "Vintage Denim Jacket"
   - "Pleated Mini Skirt"
   - "Oversized Hoodie Sweater"
   - "Fitted Pencil Dress"
   - "Striped Long-Sleeve Tee"
   
   Be SPECIFIC and DESCRIPTIVE. Don't use vague terms like "Basic Tee" or "Fashion item".

Respond ONLY with valid JSON in this exact format:
{
  "category": "Feminine",
  "color": "YELLOW",
  "sizes": "S|M|L|XL",
  "style": "Casual Cotton T-Shirt"
}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: image.mimeType,
              data: image.base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 400,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Gemini API error: ${errorMessage}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const content =
    Array.isArray(parts)
      ? parts
          .map((part: { text?: string }) => part?.text || "")
          .join("")
          .trim()
      : "";

  if (!content) {
    throw new Error("Invalid response from Gemini API");
  }

  const contentText = content;
  
  try {
    const parsed = JSON.parse(content);
    
    const category = (parsed.category || "Feminine").toString().trim();
    const color = normalizeColor(parsed.color?.toString());
    const sizes = (parsed.sizes || "S|M|L|XL").toString().trim();
    const style = (parsed.style || "Fashion item").toString().trim();
    
    const validCategories = ["Feminine", "Masculine", "Children"];
    const normalizedCategory = validCategories.find(
      cat => cat.toLowerCase() === category.toLowerCase()
    ) || "Feminine";
    
    return {
      category: normalizedCategory,
      color,
      sizes: sizes,
      style: style,
      confidence: 0.85,
      raw_response: content
    };
  } catch {
    const categoryMatch = content.match(/category['":\s]*['"]?(\w+)['"]?/i);
    const colorMatch = content.match(/color['":\s]*['"]?(\w+)['"]?/i);
    const sizesMatch = content.match(/sizes?['":\s]*['"]?([^'"]+)['"]?/i);
    const styleMatch = content.match(/style['":\s]*['"]?([^'"]+)['"]?/i);
    
    return {
      category: categoryMatch?.[1] || "Feminine",
      color: normalizeColor(colorMatch?.[1]?.toString()),
      sizes: sizesMatch?.[1] || "S|M|L|XL",
      style: styleMatch?.[1] || content.slice(0, 50),
      confidence: 0.6,
      raw_response: content
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = imageExtractSchema.parse(body);
    const geminiKey = process.env.GEMINI_API_KEY;
    
    console.log("[extract-meta] GEMINI_API_KEY present?", Boolean(geminiKey));
    console.log("[extract-meta] Image source:", payload.imageUrl ? "URL" : payload.imageBase64 ? "base64" : "none");
    
    if (!geminiKey) {
      console.warn("[extract-meta] GEMINI_API_KEY missing, using heuristic");
      const heuristic = heuristicFromFilename(payload.imageUrl ?? null);
      return NextResponse.json({
        category: heuristic.category,
        color: heuristic.color,
        sizes: heuristic.sizes,
        style: heuristic.style,
        confidence: heuristic.confidence,
        warning: "GEMINI_API_KEY missing – using heuristic guess.",
        raw_json: { hint: heuristic.hint },
      });
    }

    if (!payload.imageUrl && !payload.imageBase64) {
      const heuristic = heuristicFromFilename(null);
      return NextResponse.json({
        category: heuristic.category,
        color: heuristic.color,
        sizes: heuristic.sizes,
        style: heuristic.style,
        confidence: heuristic.confidence,
        warning: "No image provided – using default values.",
        raw_json: { hint: heuristic.hint },
      });
    }

    try {
      const imageSource = payload.imageUrl ?? payload.imageBase64 ?? undefined;

      if (!imageSource) {
        throw new Error("No image URL or base64 data provided");
      }

      console.log("[extract-meta] Preparing image for Gemini...");
      const preparedImage = await prepareImageForGemini(imageSource);
      console.log("[extract-meta] Image prepared, mime:", preparedImage.mimeType);

      console.log("[extract-meta] Calling Gemini API...");
      const result = await analyzeImageWithGemini(preparedImage, geminiKey);
      console.log("[extract-meta] Gemini response received:", result);

      return NextResponse.json({
        category: result.category,
        color: result.color,
        sizes: result.sizes,
        style: result.style,
        confidence: result.confidence,
        raw_json: { gemini_response: result.raw_response },
      });

    } catch (geminiError) {
      console.error("[extract-meta] Gemini API error:", geminiError);
      
      const heuristic = heuristicFromFilename(payload.imageUrl ?? null);
      return NextResponse.json({
        category: heuristic.category,
        color: heuristic.color,
        sizes: heuristic.sizes,
        style: heuristic.style,
        confidence: heuristic.confidence,
        warning: `Gemini API failed: ${geminiError instanceof Error ? geminiError.message : 'Unknown error'} – using heuristic fallback.`,
        raw_json: { error: geminiError instanceof Error ? geminiError.message : 'Unknown error' },
      });
    }

  } catch (error) {
    console.error("[Extract API] Error:", error);
    
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> };
      return NextResponse.json(
        {
          error: "Validation error",
          details: zodError.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', '),
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to extract metadata",
      },
      { status: 400 }
    );
  }
}
