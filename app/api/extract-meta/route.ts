import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { imageExtractSchema } from "@/lib/validators";
import { createSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase";

const COLOR_KEYWORDS: Record<string, string[]> = {
  Black: ["black", "noir", "ebony", "ink"],
  White: ["white", "ivory", "cream"],
  Beige: ["beige", "sand", "khaki"],
  Blue: ["blue", "navy", "cobalt", "azure"],
  Red: ["red", "crimson", "scarlet", "ruby"],
  Green: ["green", "emerald", "sage", "olive"],
  Pink: ["pink", "blush", "rose"],
  Purple: ["purple", "violet", "lavender"],
  Brown: ["brown", "cocoa", "mocha"],
  Gray: ["gray", "grey", "slate", "ash"],
};

const QWEN_API_URL = "https://router.huggingface.co/v1/chat/completions";
const QWEN_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic";
const SUPABASE_IMAGE_BUCKET =
  process.env.SUPABASE_IMAGE_BUCKET || "product-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour window for Qwen to fetch the asset
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

async function resolveImageForQwen(source: string) {
  if (!source.startsWith("data:")) {
    return source;
  }

  const match = DATA_URL_REGEX.exec(source);
  if (!match?.[1] || !match?.[2]) {
    throw new Error("Invalid data URL provided for image analysis.");
  }

  if (!isSupabaseConfigured("service")) {
    throw new Error(
      "Received data URL image but Supabase service credentials are missing. Unable to upload image for Qwen."
    );
  }

  const mime = match[1];
  const payload = match[2];
  const extension = extensionFromMime(mime);
  if (!extension) {
    throw new Error(`Unsupported image MIME type: ${mime}`);
  }

  const buffer = Buffer.from(payload, "base64");
  const objectKey = `qwen-extract/${randomUUID()}.${extension}`;

  const supabase = createSupabaseServiceClient();
  const bucket = supabase.storage.from(SUPABASE_IMAGE_BUCKET);

  const upload = await bucket.upload(objectKey, buffer, {
    cacheControl: "300",
    contentType: mime,
    upsert: true,
  });

  if (upload.error) {
    throw new Error(
      `Failed to upload inline image for Qwen: ${
        upload.error.message || "Unknown Supabase error"
      }`
    );
  }

  const { data: signedData, error: signedError } = await bucket.createSignedUrl(
    objectKey,
    SIGNED_URL_TTL_SECONDS
  );

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      signedError?.message ||
        "Unable to create signed URL for uploaded image asset."
    );
  }

  return signedData.signedUrl;
}

function heuristicFromFilename(source: string | null | undefined) {
  if (!source) {
    return {
      category: "Feminine",
      color: "BLACK",
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
    color: "BLACK",
    sizes: "S|M|L|XL",
    style: "Contemporary minimal",
    confidence: 0.25,
    hint: "No color keywords detected; defaulting to minimal styling.",
  };
}

async function analyzeImageWithQwen(imageUrl: string) {
  const hfToken = process.env.HF_TOKEN;

  if (!hfToken) {
    throw new Error("HF_TOKEN environment variable is required");
  }

  const payload = {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this fashion item image and extract the following information:

1. **Category**: Classify as one of:
   - "Feminine" (women's clothing, dresses, skirts, feminine styles)
   - "Masculine" (men's clothing, suits, masculine styles)
   - "Children" (kids' clothing)

2. **Color**: Primary color (one word). Choose from: BLACK, WHITE, BLUE, RED, GREEN, PINK, PURPLE, BEIGE, GRAY, BROWN, or closest match.

3. **Sizes**: Available sizes in pipe-separated format. Common patterns:
   - "S|M|L|XL" (standard)
   - "XS|S|M|L|XL" (extended)
   - "M|L" (limited)
   - "S|M|L" (basic)
   If unclear, use "S|M|L|XL" as default.

4. **Style**: Brief description of the item (e.g., "Basic Tee", "Casual Dress", "Formal Shirt")

Respond ONLY with valid JSON in this exact format:
{
  "category": "Feminine",
  "color": "BLACK",
  "sizes": "S|M|L|XL",
  "style": "Basic Tee"
}`
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    model: QWEN_MODEL,
    max_tokens: 300,
    temperature: 0.1
  };

  const response = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Qwen API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Invalid response from Qwen API");
  }

  const content = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    
    const category = (parsed.category || "Feminine").toString().trim();
    const color = (parsed.color || "BLACK").toString().toUpperCase().trim();
    const sizes = (parsed.sizes || "S|M|L|XL").toString().trim();
    const style = (parsed.style || "Fashion item").toString().trim();
    
    const validCategories = ["Feminine", "Masculine", "Children"];
    const normalizedCategory = validCategories.find(
      cat => cat.toLowerCase() === category.toLowerCase()
    ) || "Feminine";
    
    const validColors = ["BLACK", "WHITE", "BLUE", "RED", "GREEN", "PINK", "PURPLE", "BEIGE", "GRAY", "BROWN"];
    const normalizedColor = validColors.find(
      col => col === color || col.toLowerCase() === color.toLowerCase()
    ) || "BLACK";
    
    return {
      category: normalizedCategory,
      color: normalizedColor,
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
      color: (colorMatch?.[1] || "BLACK").toUpperCase(),
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
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      const heuristic = heuristicFromFilename(payload.imageUrl ?? null);
      return NextResponse.json({
        category: heuristic.category,
        color: heuristic.color,
        sizes: heuristic.sizes,
        style: heuristic.style,
        confidence: heuristic.confidence,
        warning: "HF_TOKEN missing – using heuristic guess.",
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

      const resolvedImageUrl = await resolveImageForQwen(imageSource);

      const result = await analyzeImageWithQwen(resolvedImageUrl);

      return NextResponse.json({
        category: result.category,
        color: result.color,
        sizes: result.sizes,
        style: result.style,
        confidence: result.confidence,
        raw_json: { qwen_response: result.raw_response },
      });

    } catch (qwenError) {
      console.error("Qwen API error:", qwenError);
      
      const heuristic = heuristicFromFilename(payload.imageUrl ?? null);
      return NextResponse.json({
        category: heuristic.category,
        color: heuristic.color,
        sizes: heuristic.sizes,
        style: heuristic.style,
        confidence: heuristic.confidence,
        warning: `Qwen API failed: ${qwenError instanceof Error ? qwenError.message : 'Unknown error'} – using heuristic fallback.`,
        raw_json: { error: qwenError instanceof Error ? qwenError.message : 'Unknown error' },
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
