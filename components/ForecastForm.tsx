"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { clsx } from "clsx";
import Image from "next/image";
import ForecastResult from "./ForecastResult";
import { type ForecastRequest, type ForecastResponse, forecastRequestSchema, forecastResponseSchema } from "@/lib/validators";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { cardClassName, headingClassName, subtleTextClassName } from "@/lib/theme";
import { z } from "zod";
import { useTranslation } from "@/lib/i18n/client";
import { fetchForecastFromSpace } from "@/lib/forecast-space-client";

const FORM_SCHEMA = forecastRequestSchema.pick({ horizon: true, product: true });

type FormValues = z.infer<typeof FORM_SCHEMA>;

type UploadResult = {
  url: string | null;
  base64: string | null;
};

async function fileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  uint8Array.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

const sampleEditorialImage =
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=720&q=80";

// ตั้งค่า NEXT_PUBLIC_FORECAST_SERVICE_URL เพื่อให้ฟอร์มเรียก Hugging Face Space โดยตรง
// (หลบ timeout ของ Vercel serverless). ถ้าไม่ได้ตั้ง จะ fallback ไปใช้ API route เดิม.
const FORECAST_SPACE_BASE = process.env.NEXT_PUBLIC_FORECAST_SERVICE_URL?.trim() || null;

export default function ForecastForm() {
  const supabaseEnabled = isSupabaseConfigured("anon");
  const { t, language } = useTranslation();
  const renderError = useCallback(
    (message?: string | null) => {
      if (!message) return null;
      const translated = t(message);
      return translated === message ? message : translated;
    },
    [t]
  );
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [csvUpload, setCsvUpload] = useState<UploadResult | null>(null);
  const [imageUpload, setImageUpload] = useState<UploadResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forecastResult, setForecastResult] = useState<ForecastResponse | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving">("idle");
  const [insight, setInsight] = useState<string>("");
  const [isInsightStreaming, setIsInsightStreaming] = useState(false);

  useEffect(() => {
    if (!forecastResult?.forecastId) {
      setInsight(forecastResult?.summary ?? "");
      setIsInsightStreaming(false);
      return;
    }

    const baseSummary = forecastResult?.summary ?? "";
    setInsight(baseSummary);

    if (baseSummary) {
      setIsInsightStreaming(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        setIsInsightStreaming(true);
        const langParam = language === "th" ? "th" : "en";
        const response = await fetch(
          `/api/forecast/${forecastResult.forecastId}/insight?lang=${langParam}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Insight request failed (${response.status})`);
        }

        if (!response.body) {
          throw new Error("Insight stream missing body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            accumulated += decoder.decode();
            break;
          }
          accumulated += decoder.decode(value, { stream: true });
          if (!cancelled) {
            setInsight(accumulated);
          }
        }
        if (!cancelled) {
          setInsight(accumulated.trim());
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[ForecastForm] Insight stream error:", error);
        }
      } finally {
        if (!cancelled) {
          setIsInsightStreaming(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [forecastResult?.forecastId, forecastResult?.summary, language]);

const formResolver = zodResolver(FORM_SCHEMA) as Resolver<FormValues>;

const {
  register,
  handleSubmit,
  setValue,
  reset,
  formState: { errors },
} = useForm<FormValues>({
  resolver: formResolver,
  defaultValues: {
    horizon: 6,
    product: {
      sku: "",
      title: "",
      category: "",
      color: "",
      sizes: "",
      cost: 1,
      first_sale_month: "",
    },
  },
});

  const supabaseClient = useMemo(() => {
    if (!supabaseEnabled) return null;
    try {
      return getSupabaseBrowserClient();
    } catch (error) {
      console.warn("Failed to initialize Supabase client", error);
      return null;
    }
  }, [supabaseEnabled]);

  const ensureCsvUpload = useCallback(async (): Promise<UploadResult | null> => {
    if (!csvFile) return null;
    if (csvUpload && (csvUpload.url || csvUpload.base64)) {
      return csvUpload;
    }

    if (supabaseClient) {
      const ext = csvFile.name.split(".").pop()?.toLowerCase() ?? "csv";
      const path = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseClient
        .storage.from("exports")
        .upload(path, csvFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: csvFile.type || "text/csv",
        });
      if (!error) {
        const { data } = supabaseClient.storage.from("exports").getPublicUrl(path);
        const result = { url: data?.publicUrl ?? null, base64: null };
        setCsvUpload(result);
        return result;
      }
      console.warn("Failed to upload csv to Supabase", error);
    }

    const base64 = await fileToBase64(csvFile);
    const result = { url: null, base64: `data:${csvFile.type || "text/csv"};base64,${base64}` };
    setCsvUpload(result);
    return result;
  }, [csvFile, csvUpload, supabaseClient]);

  const ensureImageUpload = useCallback(async (): Promise<UploadResult | null> => {
    if (!imageFile) return null;
    if (imageUpload && (imageUpload.url || imageUpload.base64)) {
      return imageUpload;
    }

    if (supabaseClient) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseClient
        .storage.from("product-images")
        .upload(path, imageFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: imageFile.type || "image/jpeg",
        });
      if (!error) {
        const { data } = supabaseClient
          .storage.from("product-images")
          .getPublicUrl(path);
        const result = { url: data?.publicUrl ?? null, base64: null };
        setImageUpload(result);
        return result;
      }
      console.warn("Failed to upload image to Supabase", error);
    }

    const base64 = await fileToBase64(imageFile);
    const result = {
      url: null,
      base64: `data:${imageFile.type || "image/jpeg"};base64,${base64}`,
    };
    setImageUpload(result);
    return result;
  }, [imageFile, imageUpload, supabaseClient]);

  const handleCsvChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCsvFile(file);
    setCsvUpload(null);
  }, []);

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setImageUpload(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }, [imagePreview]);

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setInsight("");
    setIsInsightStreaming(false);

    console.log("[ForecastForm] Submitting with values:", values);

    try {
      const csv = await ensureCsvUpload();
      const image = await ensureImageUpload();

      const normalizedProduct = {
        ...values.product,
        first_sale_month: values.product.first_sale_month.includes("-")
          ? `${values.product.first_sale_month.slice(0, 7)}-01`
          : values.product.first_sale_month,
      };

      console.log("[ForecastForm] Normalized product:", normalizedProduct);

      const resolvedModel: ForecastRequest["model"] = csv ? "lgbm_full" : "lgbm_meta";

      const payload: ForecastRequest = {
        model: resolvedModel,
        horizon: values.horizon,
        product: normalizedProduct,
        salesCsvUrl: csv?.url ?? null,
        salesCsvContent: csv?.base64 ?? null,
        imageUrl: image?.url ?? null,
        imageBase64: image?.base64 ?? null,
        language,
      };

      let finalForecast: ForecastResponse | null = null;
      let finalStatusMessage: string | null = null;

      if (FORECAST_SPACE_BASE) {
        // NOTE: เรียกไปยัง Hugging Face Space โดยตรงเพื่อเลี่ยง server timeout
        // ถ้าจะกลับมาใช้ API route ให้ลบ env นี้แล้ว fallback ด้านล่างจะทำงานทันที
        const spaceForecast = await fetchForecastFromSpace(
          FORECAST_SPACE_BASE,
          payload
        );

        try {
          const persistResponse = await fetch("/api/forecast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              externalResult: spaceForecast,
            }),
          });

          if (!persistResponse.ok) {
            const errorText = await persistResponse.text();
            throw new Error(errorText || t("forecastForm.errors.saveFailed"));
          }

          const persistedJson = await persistResponse.json();
          finalForecast = forecastResponseSchema.parse(persistedJson);
          finalStatusMessage = t("forecastForm.status.forecastSaved");
        } catch (persistError) {
          console.error("[ForecastForm] Persist failed:", persistError);
          finalForecast = spaceForecast;
          setErrorMessage(t("forecastForm.errors.saveFailed"));
        }
      } else {
        const response = await fetch("/api/forecast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || t("forecastForm.errors.forecastFailed"));
        }

        const json = await response.json();
        finalForecast = forecastResponseSchema.parse(json);
        finalStatusMessage = t("forecastForm.status.forecastSaved");
      }

      if (!finalForecast) {
        throw new Error(t("forecastForm.errors.forecastFailed"));
      }

      setForecastResult(finalForecast);
      setStatusMessage(finalStatusMessage);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("forecastForm.errors.unexpected")
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleExtract = useCallback(async () => {
    if (!imageFile) {
      setErrorMessage(t("forecastForm.errors.imageRequired"));
      return;
    }
    setIsExtracting(true);
    setErrorMessage(null);

    try {
      const image = await ensureImageUpload();
      
      if (!image?.url && !image?.base64) {
        throw new Error(t("forecastForm.errors.imageUploadFailed"));
      }

      const payload = {
        imageUrl: image?.url || null,
        imageBase64: image?.base64 || null,
      };

      const response = await fetch("/api/extract-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || t("forecastForm.errors.extractionFailed"));
      }
      
      const json = await response.json();
      if (json?.category) {
        setValue("product.category", json.category, { shouldValidate: true });
      }
      if (json?.color) {
        setValue("product.color", json.color, { shouldValidate: true });
      }
      if (json?.sizes) {
        setValue("product.sizes", json.sizes, { shouldValidate: true });
      }
      if (json?.style) {
        setValue("product.title", json.style, { shouldDirty: false });
      }
      setStatusMessage(t("forecastForm.status.metadataExtracted"));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("forecastForm.errors.extractionFailed")
      );
    } finally {
      setIsExtracting(false);
    }
  }, [ensureImageUpload, imageFile, setValue, t]);

  const handleReset = useCallback(() => {
    reset();
    setCsvFile(null);
    setImageFile(null);
    setCsvUpload(null);
    setImageUpload(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    setForecastResult(null);
    setStatusMessage(null);
    setErrorMessage(null);
    setInsight("");
    setIsInsightStreaming(false);
  }, [imagePreview, reset]);

  const handleSave = useCallback(async () => {
    if (!forecastResult?.forecastId) {
      setStatusMessage(t("common.runForecastFirst"));
      return;
    }
    setSaveState("saving");
    setStatusMessage(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forecastId: forecastResult.forecastId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || t("forecastForm.errors.saveFailed"));
      }
      const json = await response.json();
      setStatusMessage(json?.message ?? t("common.forecastExportSaved"));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("forecastForm.errors.saveFailed")
      );
    } finally {
      setSaveState("idle");
    }
  }, [forecastResult?.forecastId, t]);

  const inputClassName =
    "rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent";
  const fileInputClassName =
    "block w-full cursor-pointer rounded-xl border border-dashed border-border px-4 py-3 text-sm text-foreground-muted transition hover:border-accent focus:border-accent";

  return (
    <div className="space-y-10">
      <section className={clsx(cardClassName, "p-6 lg:p-10")}>
        <header className="space-y-2">
          <h1 className={headingClassName}>{t("forecastForm.heading")}</h1>
          <p className={subtleTextClassName}>{t("forecastForm.description")}</p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(260px,300px),1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-hover p-4">
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">{t("forecastForm.image.label")}</span>
                <span className="text-xs text-foreground-muted">
                  {t("forecastForm.image.optional")}
                </span>
              </div>
              <div className="relative mt-4 flex h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt={t("forecastForm.image.previewAlt")}
                    fill
                    sizes="(min-width: 1024px) 280px, 100vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <Image
                    src={sampleEditorialImage}
                    alt={t("forecastForm.image.previewAlt")}
                    fill
                    sizes="(min-width: 1024px) 280px, 100vw"
                    className="object-cover"
                    priority
                  />
                )}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-center text-xs text-white">
                  <span className="text-sm font-semibold">
                    {t("forecastForm.image.cta")}
                  </span>
                  <span>{t("forecastForm.image.instructions")}</span>
                </div>
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              {imageFile ? (
                <p className="mt-2 text-xs text-foreground-muted" aria-live="polite">
                  {imageFile.name}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleExtract}
                disabled={isExtracting}
                className="mt-3 w-full rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExtracting
                  ? t("forecastForm.image.extracting")
                  : t("forecastForm.image.extract")}
              </button>
            </div>
          </aside>

          <form className="space-y-8" onSubmit={onSubmit}>
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.horizon")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.horizon")}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={inputClassName}
                  {...register("horizon", { valueAsNumber: true })}
                />
                {errors.horizon ? (
                  <span className="text-xs text-red-500">
                    {renderError(errors.horizon.message)}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.sku")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.sku")}
                  </span>
                </div>
                <input
                  type="text"
                  className={inputClassName}
                  {...register("product.sku")}
                />
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.title")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.title")}
                  </span>
                </div>
                <input
                  type="text"
                  className={inputClassName}
                  {...register("product.title")}
                />
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.category")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.category")}
                  </span>
                </div>
                <input
                  type="text"
                  className={inputClassName}
                  {...register("product.category")}
                />
                {errors.product?.category ? (
                  <span className="text-xs text-red-500">
                    {renderError(errors.product.category.message)}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.color")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.color")}
                  </span>
                </div>
                <input
                  type="text"
                  className={inputClassName}
                  {...register("product.color")}
                />
                {errors.product?.color ? (
                  <span className="text-xs text-red-500">
                    {renderError(errors.product.color.message)}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.sizes")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.sizes")}
                  </span>
                </div>
                <input
                  type="text"
                  className={inputClassName}
                  {...register("product.sizes")}
                />
                {errors.product?.sizes ? (
                  <span className="text-xs text-red-500">
                    {renderError(errors.product.sizes.message)}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.cost")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.cost")}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClassName}
                  {...register("product.cost", { valueAsNumber: true })}
                />
                {errors.product?.cost ? (
                  <span className="text-xs text-red-500">
                    {renderError(errors.product.cost.message)}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("forecastForm.fields.firstSaleMonth")}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {t("forecastForm.examples.firstSaleMonth")}
                  </span>
                </div>
                <input
                  type="month"
                  className={inputClassName}
                  {...register("product.first_sale_month")}
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-foreground">
                  {t("forecastForm.csv.label")}
                </span>
                <span className="text-xs text-foreground-muted">
                  {t("forecastForm.csv.optional")}
                </span>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvChange}
                className={fileInputClassName}
              />
              {csvFile ? (
                <p className="text-xs text-foreground-muted" aria-live="polite">
                  {csvFile.name}
                </p>
              ) : null}
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200/70 bg-red-50/70 px-4 py-3 text-sm text-red-600 shadow-sm">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full border border-accent bg-accent px-6 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? t("forecastForm.buttons.running")
                  : t("forecastForm.buttons.run")}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-border px-6 py-2 text-sm font-semibold text-foreground transition hover:border-accent"
              >
                {t("forecastForm.buttons.reset")}
              </button>
            </div>
          </form>
        </div>
      </section>

      {forecastResult ? (
        <ForecastResult
          data={forecastResult}
          onSave={handleSave}
          isSaving={saveState === "saving"}
          statusMessage={statusMessage}
          insight={insight}
          isInsightStreaming={isInsightStreaming}
        />
      ) : null}
    </div>
  );
}
