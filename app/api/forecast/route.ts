import { NextResponse } from "next/server";
import {
  forecastRequestSchema,
  type ForecastRequest,
  forecastResponseSchema,
  type ForecastResponse,
} from "@/lib/validators";
import { convertCurrencyToUsd, normalizeCurrencyCode } from "@/lib/currency";
import {
  getCsvNote,
  normalizeHistoricalCsv,
  SupportedLanguage,
} from "@/lib/csv-helper";
import {
  translateThaiProduct,
  CATEGORY_MAP,
  sanitizeText,
} from "@/lib/text-normalization";
import {
  runRemoteInference,
  type PythonForecastResponse,
} from "@/lib/forecast-service";
import { persistForecast } from "@/lib/forecast-persistence";

export const runtime = "nodejs";
export const maxDuration = 60;

const extendedForecastRequestSchema = forecastRequestSchema.extend({
  externalResult: forecastResponseSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const extendedParsed = extendedForecastRequestSchema.parse(raw);
    const { externalResult, ...parsedWithoutExternal } = extendedParsed;
    const parsed = parsedWithoutExternal as ForecastRequest;
    const requestLanguage: SupportedLanguage = parsed.language === "th" ? "th" : "en";
    const productWithThaiNormalization = translateThaiProduct(parsed.product);

    // Normalize product values directly without LLM validation
    const upperCategory = (productWithThaiNormalization.category || "").toString().toUpperCase().trim();
    const mappedCategory = CATEGORY_MAP[upperCategory] || upperCategory;

    const productToUse = {
      ...productWithThaiNormalization,
      category: mappedCategory,
      color: (productWithThaiNormalization.color || "").toString().toUpperCase().trim(),
      sizes: (productWithThaiNormalization.sizes || "").toString().toUpperCase().trim(),
    };

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

    const requestCurrency = normalizeCurrencyCode(parsed.currency);
    const modelProduct = {
      ...normalizedProduct,
      cost: convertCurrencyToUsd(normalizedProduct.cost, requestCurrency),
    };

    if (modelProduct.cost <= 0) {
      modelProduct.cost = 1;
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
      currency: requestCurrency,
      model: resolvedModel,
      product: modelProduct,
      salesCsvContent,
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