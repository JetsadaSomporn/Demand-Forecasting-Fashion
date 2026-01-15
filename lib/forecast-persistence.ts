import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  ForecastRequest,
  ForecastResponse,
} from "@/lib/validators";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { normalizeCurrencyCode } from "@/lib/currency";

const LOCAL_FORECAST_DIR = path.join(process.cwd(), ".data/forecasts");

export async function persistForecast(
  payload: ForecastRequest,
  result: ForecastResponse,
  normalizedProduct: ForecastRequest["product"],
  warning?: string | null
) {
  const supabaseReady = isSupabaseConfigured("service");
  const timestamp = new Date().toISOString();
  let forecastId = randomUUID();
  const currency = normalizeCurrencyCode(payload.currency);
  const productParams = { ...normalizedProduct, currency };

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
        product: productParams,
        productCurrency: currency,
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
    try {
      await fs.mkdir(LOCAL_FORECAST_DIR, { recursive: true });
      const record = {
        id: forecastId,
        product: productParams,
        model_name: result.model,
        horizon: result.horizon,
        params: {
          product: productParams,
          productCurrency: currency,
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
    } catch (error) {
      console.error("Local filesystem persistence error", error);
    }
  }

  return forecastId;
}
