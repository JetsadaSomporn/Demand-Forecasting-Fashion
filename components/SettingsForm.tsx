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
    <div className="min-h-screen bg-white py-24 px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 space-y-2 text-left">
          <h1 className="text-[13px] font-bold uppercase tracking-[0.35em] text-gray-900">
            {t("settings.heading")}
          </h1>
          <p className="max-w-xl text-xs leading-relaxed text-gray-600">
            {t("settings.description")}
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-8 rounded-[28px] border-2 border-gray-200 bg-white p-8 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >

          <section className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900" htmlFor="displayName">
                {t("settings.fields.displayName.label")}
              </label>
              <input
                id="displayName"
                type="text"
                placeholder={t("settings.fields.displayName.placeholder")}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                {...register("displayName")}
              />
              {errors.displayName ? (
                <p className="text-xs text-red-500">
                  {translateError(errors.displayName.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900" htmlFor="brandName">
                {t("settings.fields.brandName.label")}
              </label>
              <input
                id="brandName"
                type="text"
                placeholder={t("settings.fields.brandName.placeholder")}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                {...register("brandName")}
              />
              {errors.brandName ? (
                <p className="text-xs text-red-500">
                  {translateError(errors.brandName.message)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900" htmlFor="timezone">
                {t("settings.fields.timezone")}
              </label>
              <select
                id="timezone"
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
              <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900" htmlFor="currency">
                {t("settings.fields.currency")}
              </label>
              <select
                id="currency"
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
              <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900" htmlFor="language">
                {t("settings.fields.language")}
              </label>
              <select
                id="language"
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full border-2 border-blue-600 bg-blue-600 px-8 py-3 text-xs font-bold uppercase tracking-[0.3em] text-white shadow-[0_8px_16px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:border-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSubmitting
                ? t("settings.buttons.saving")
                : t("settings.buttons.save")}
            </button>
            {status ? <span className="text-xs text-gray-600">{status}</span> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
