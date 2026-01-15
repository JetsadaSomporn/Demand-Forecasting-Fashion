"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  settingsSchema,
  type SettingsFormInput,
  type SettingsFormValues,
} from "@/lib/validators";
import { useTranslation } from "@/lib/i18n/client";
import type { Language } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/client";

const timezones = [
  "UTC",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

const currencies = ["THB", "USD", "EUR", "GBP", "JPY"];

const themeOptions = [
  {
    value: "dark",
    titleKey: "settings.theme.dark.title",
    descriptionKey: "settings.theme.dark.description",
  },
  {
    value: "light",
    titleKey: "settings.theme.light.title",
    descriptionKey: "settings.theme.light.description",
  },
] as const;

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
    watch,
  formState: { errors, isSubmitting },
  getValues,
  } = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaults,
  });

  const [status, setStatus] = useState<string | null>(null);
  const { setTheme: setClientTheme } = useTheme();
  const selectedTheme = watch("theme");
  const hasAppliedInitialTheme = useRef(false);

  useEffect(() => {
    if (!selectedTheme) return;
    setClientTheme(selectedTheme);
    if (!hasAppliedInitialTheme.current) {
      hasAppliedInitialTheme.current = true;
      return;
    }

    let cancelled = false;
    const persistTheme = async () => {
      try {
        setStatus(t("settings.buttons.saving"));
        const payload = { ...getValues(), theme: selectedTheme };
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || t("settings.errors.saveFailed"));
        }
        if (!cancelled) {
          setStatus(t("settings.status.saved"));
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(
            error instanceof Error ? error.message : t("settings.errors.saveFailed")
          );
        }
      }
    };

    void persistTheme();

    return () => {
      cancelled = true;
    };
  }, [selectedTheme, setClientTheme, getValues, t]);
  const fieldClassName =
    "w-full rounded-lg border border-white/20 bg-white/12 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white focus:ring-2 focus:ring-white/30";
  const labelClassName =
    "text-[11px] font-bold uppercase tracking-[0.3em] text-white/70";

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
      setStatus(
        error instanceof Error ? error.message : t("settings.errors.saveFailed")
      );
    }
  });

  return (
    <div className="min-h-screen px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 space-y-3 text-left">
          <h1 className="text-sm font-bold uppercase tracking-[0.35em] text-white/75">
            {t("settings.heading")}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/60">
            {t("settings.description")}
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-8 rounded-xl border border-white/10 bg-white/12 p-8 shadow-[0_40px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >

          <section className="space-y-6">
            <div className="space-y-2">
              <label className={labelClassName} htmlFor="displayName">
                {t("settings.fields.displayName.label")}
              </label>
              <input
                id="displayName"
                type="text"
                placeholder=""
                className={fieldClassName}
                {...register("displayName")}
              />
              {errors.displayName ? (
                <p className="text-xs text-red-500">
                  {translateError(errors.displayName.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className={labelClassName} htmlFor="brandName">
                {t("settings.fields.brandName.label")}
              </label>
              <input
                id="brandName"
                type="text"
                placeholder=""
                className={fieldClassName}
                {...register("brandName")}
              />
              {errors.brandName ? (
                <p className="text-xs text-red-500">
                  {translateError(errors.brandName.message)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <label className={labelClassName}>{t("settings.fields.theme")}</label>
            <div className="grid gap-4 sm:grid-cols-2">
              {themeOptions.map((option) => {
                const isSelected = selectedTheme === option.value;
                return (
                  <label
                    key={option.value}
                    className={`group flex cursor-pointer flex-col gap-3 rounded-xl border px-5 py-5 transition ${
                      isSelected
                        ? "border-accent bg-white/12 shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
                        : "border-white/12 bg-white/5 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      className="sr-only"
                      {...register("theme")}
                    />
                    <div className="hidden" />
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white">
                        {t(option.titleKey)}
                      </p>
                      <p className="text-sm leading-relaxed text-white/60">
                        {t(option.descriptionKey)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClassName} htmlFor="timezone">
                {t("settings.fields.timezone")}
              </label>
              <select
                id="timezone"
                className={fieldClassName}
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
              <label className={labelClassName} htmlFor="currency">
                {t("settings.fields.currency")}
              </label>
              <select
                id="currency"
                className={fieldClassName}
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
              <label className={labelClassName} htmlFor="language">
                {t("settings.fields.language")}
              </label>
              <select
                id="language"
                className={fieldClassName}
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
              className="rounded-full bg-transparent px-8 py-3 text-xs font-bold uppercase tracking-[0.3em] text-white shadow-[0_18px_32px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:text-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/15 supports-[backdrop-filter]:backdrop-blur-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSubmitting
                ? t("settings.buttons.saving")
                : t("settings.buttons.save")}
            </button>
            {status ? <span className="text-xs text-white/60">{status}</span> : null}
          </div>
        </form>
      </div>
    </div>
  );
}