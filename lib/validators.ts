import { z } from "zod";

export const productMetadataSchema = z.object({
  sku: z.string().trim().max(64).default(""),
  title: z.string().trim().max(120).default(""),
  category: z
    .string()
    .min(1, { message: "validators.categoryRequired" })
    .max(80),
  color: z
    .string()
    .min(1, { message: "validators.colorRequired" })
    .max(80),
  sizes: z
    .string()
    .min(1, { message: "validators.sizesRequired" })
    .max(80),
  cost: z.coerce.number().positive({ message: "validators.costPositive" }),
  first_sale_month: z.string().min(7).max(10),
});

export const forecastRequestSchema = z.object({
  model: z.enum(["lgbm_full", "lgbm_meta"]),
  horizon: z.number().int().min(1).max(12),
  product: productMetadataSchema,
  salesCsvUrl: z.string().url().optional().nullable(),
  salesCsvContent: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  imageBase64: z.string().optional().nullable(),
});

export type ForecastRequest = z.infer<typeof forecastRequestSchema>;

export const forecastResponseSchema = z.object({
  forecastId: z.string().uuid().optional(),
  model: z.enum(["lgbm_full", "lgbm_meta"]),
  horizon: z.number(),
  used_model: z.boolean().optional(),
  y_pred: z.array(z.number()),
  y_true: z.array(z.number()).nullable().optional(),
  months: z.array(z.string()),
  exportPath: z.string().optional(),
  warning: z.string().optional(),
});

export const settingsSchema = z.object({
  displayName: z.string().min(1).max(80),
  brandName: z.string().min(1).max(120),
  timezone: z.string().min(1),
  currency: z.string().min(1).max(8),
  language: z.enum(["en", "th"]),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export const imageExtractSchema = z.object({
  imageUrl: z.union([z.string().url(), z.null()]).optional(),
  imageBase64: z.union([z.string(), z.null()]).optional(),
});

export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
