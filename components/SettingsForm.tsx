"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { settingsSchema, type SettingsFormValues } from "@/lib/validators";
import { useTranslation } from "@/lib/i18n/client";
import type { Language } from "@/lib/i18n";

const timezones = [
  "UTC",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

const currencies = ["THB", "USD", "EUR", "GBP", "JPY"];

type SettingsFormProps = {
  defaults: SettingsFormValues;
};

export default function SettingsForm({ defaults }: SettingsFormProps) {
  const { t, languages, setLanguage: setUiLanguage } = useTranslation();
  const translateError = (message?: string) => {
    if (!message) return null;
    const translated = t(message);
    return translated === message ? message : translated;
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaults,
  });

  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || t("settings.errors.saveFailed"));
      }
      setUiLanguage(values.language);
      setStatus(t("settings.status.saved"));
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error ? error.message : t("settings.errors.saveFailed")
      );
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-8 rounded-2xl border border-border bg-surface p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]"
    >
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("settings.heading")}</h1>
        <p className="text-sm text-foreground-muted">{t("settings.description")}</p>
      </header>

      <section className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="displayName">
            {t("settings.fields.displayName.label")}
          </label>
          <input
            id="displayName"
            type="text"
            placeholder={t("settings.fields.displayName.placeholder")}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            {...register("displayName")}
          />
          {errors.displayName ? (
            <p className="text-xs text-red-500">
              {translateError(errors.displayName.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="brandName">
            {t("settings.fields.brandName.label")}
          </label>
          <input
            id="brandName"
            type="text"
            placeholder={t("settings.fields.brandName.placeholder")}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            {...register("brandName")}
          />
          {errors.brandName ? (
            <p className="text-xs text-red-500">
              {translateError(errors.brandName.message)}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="timezone">
            {t("settings.fields.timezone")}
          </label>
          <select
            id="timezone"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            {...register("timezone")}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {errors.timezone ? (
            <p className="text-xs text-red-500">
              {translateError(errors.timezone.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="currency">
            {t("settings.fields.currency")}
          </label>
          <select
            id="currency"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            {...register("currency")}
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
          {errors.currency ? (
            <p className="text-xs text-red-500">
              {translateError(errors.currency.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium text-foreground" htmlFor="language">
            {t("settings.fields.language")}
          </label>
          <select
            id="language"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            {...register("language", {
              onChange: (event) => {
                const value = event.target.value;
                if (value) {
                  setUiLanguage(value as Language);
                }
              },
            })}
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {t(`languages.${code}`)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-accent bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
        >
          {isSubmitting
            ? t("settings.buttons.saving")
            : t("settings.buttons.save")}
        </button>
        {status ? <span className="text-sm text-foreground-muted">{status}</span> : null}
      </div>
    </form>
  );
}
