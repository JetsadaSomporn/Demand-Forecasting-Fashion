import { NextResponse } from "next/server";
import { z } from "zod";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const validateFormSchema = z.object({
  product: z.object({
    title: z.string().optional(),
    category: z.string(),
    color: z.string(),
    sizes: z.string(),
    cost: z.number(),
    first_sale_month: z.string(),
  }),
});

type ValidationResult = {
  isValid: boolean;
  suggestions: {
    field: string;
    original: string;
    suggested: string;
    reason: string;
  }[];
  warnings: string[];
  correctedProduct?: {
    category?: string;
    color?: string;
    sizes?: string;
  };
};

type ProductPayload = z.infer<typeof validateFormSchema>["product"];

async function validateWithNemotron(product: ProductPayload): Promise<ValidationResult> {
  const prompt = `You are a fashion product data validator. Analyze this product information and provide corrections:

Product Details:
- Title: ${product.title || "N/A"}
- Category: ${product.category}
- Color: ${product.color}
- Sizes: ${product.sizes}
- Cost: $${product.cost}
- First Sale: ${product.first_sale_month}

Valid Options:
- Category: FEMININE, MASCULINE, CHILDREN (only these three)
- Color: BLACK, WHITE, BLUE, RED, GREEN, PINK, PURPLE, BEIGE, GRAY, BROWN
- Sizes: Should be pipe-separated like "S|M|L|XL" or "XS|S|M|L|XL"
- Cost: Should be reasonable (typically $50-$1000 for fashion items)

Check for:
1. Category typos (e.g., "Musculine" → "MASCULINE")
2. Color variations (e.g., "Navy" → "BLUE")
3. Sizes format (should use pipes, standard abbreviations)
4. Logical consistency (e.g., CHILDREN category shouldn't have XXL sizes)
5. Cost reasonableness

Respond ONLY with valid JSON in this format (no markdown, no extra text):
{
  "isValid": true/false,
  "suggestions": [
    {
      "field": "category",
      "original": "Musculine",
      "suggested": "MASCULINE",
      "reason": "Typo correction"
    }
  ],
  "warnings": ["Cost seems high for this category"],
  "correctedProduct": {
    "category": "MASCULINE",
    "color": "BLUE",
    "sizes": "M|L|XL"
  }
}`;

  try {
    if (!NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY not configured");
    }

    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2, // Low temperature for consistent validation
        top_p: 0.95,
        max_tokens: 1024, // Enough for validation response
        stream: false, // No streaming for faster response
      }),
    });

    if (!response.ok) {
      throw new Error(`Nemotron API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[Nemotron] No content in response");
      // Fallback: return basic validation
      return {
        isValid: true,
        suggestions: [],
        warnings: [],
      };
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Nemotron] No JSON found in content:", content);
      return {
        isValid: true,
        suggestions: [],
        warnings: [],
      };
    }

    const result = JSON.parse(jsonMatch[0]) as ValidationResult;
    return result;

  } catch (error) {
    console.error("[Nemotron Validation] Error:", error);
    
    // Fallback: basic validation
    return {
      isValid: true,
      suggestions: [],
      warnings: [],
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = validateFormSchema.parse(body);
    
    // Validate with Nemotron
    const validation = await validateWithNemotron(payload.product);

    return NextResponse.json({
      ...validation,
      model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    });

  } catch (error) {
    console.error("[Validate Form] Error:", error);
    
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
        error: error instanceof Error ? error.message : "Validation failed",
      },
      { status: 400 }
    );
  }
}
