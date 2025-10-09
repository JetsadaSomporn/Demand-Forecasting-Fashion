"use client";

import { useCallback, useMemo, useState } from "react";
import { clsx } from "clsx";
import MinimalChart from "./MinimalChart";
import { cardClassName, headingClassName, subtleTextClassName } from "@/lib/theme";
import type { ForecastDetail } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n/client";

function formatLabel(value: string, locale: string) {
  if (!value) return value;
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1);
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return value;
  }
}

type HistoryTableProps = {
  entries: ForecastDetail[];
  initialId?: string;
};

export default function HistoryTable({ entries, initialId }: HistoryTableProps) {
  const { t, language } = useTranslation();
  const locale = language === "th" ? "th-TH" : "en-US";
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const formatCreatedAt = useCallback(
    (value: string) => {
      try {
        return dateTimeFormatter.format(new Date(value));
      } catch {
        return value;
      }
    },
    [dateTimeFormatter]
  );
  const defaultEntry = useMemo(() => {
    if (initialId) {
      return entries.find((entry) => entry.id === initialId) ?? entries[0];
    }
    return entries[0];
  }, [entries, initialId]);

  const [selected, setSelected] = useState<ForecastDetail | undefined>(
    defaultEntry
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className={clsx(cardClassName, "overflow-hidden border-none bg-transparent p-0")}>
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-surface-hover/60 text-foreground-muted">
              <th className="px-4 py-3 font-medium">{t("history.table.skuTitle")}</th>
              <th className="px-4 py-3 font-medium">{t("history.table.model")}</th>
              <th className="px-4 py-3 font-medium">{t("history.table.horizon")}</th>
              <th className="px-4 py-3 font-medium">{t("history.table.created")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isActive = selected?.id === entry.id;
              return (
                <tr
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className={clsx(
                    "cursor-pointer border-t border-border/50 transition",
                    isActive
                      ? "bg-accent/10 text-foreground"
                      : "hover:bg-surface-hover/40"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {entry.product.title ?? entry.product.sku ?? t("dashboard.fallbackSku")}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {entry.product.category ?? "–"} · {entry.product.color ?? "–"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {entry.model_name === "lgbm_full"
                      ? t("models.historicalFull")
                      : t("models.metadataFull")}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {t("common.horizon", { count: entry.horizon })}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {formatCreatedAt(entry.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className={clsx(cardClassName, "flex flex-col gap-6 p-6")}>
          <header className="space-y-1">
            <h2 className={headingClassName}>
              {selected.product.title ?? selected.product.sku ?? t("history.detail.fallbackTitle")}
            </h2>
            <p className={subtleTextClassName}>
              {selected.model_name === "lgbm_full"
                ? t("models.historicalFull")
                : t("models.metadataFull")}
              {" · "}
              {t("common.horizon", { count: selected.horizon })}
            </p>
          </header>

          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-foreground-muted">{t("history.detail.stats.category")}:</span>
                <span className="ml-2 font-medium text-foreground">
                  {selected.product.category ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">{t("history.detail.stats.color")}:</span>
                <span className="ml-2 font-medium text-foreground">
                  {selected.product.color ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">{t("history.detail.stats.sizes")}:</span>
                <span className="ml-2 font-medium text-foreground">
                  {selected.product.sizes ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">{t("history.detail.stats.cost")}:</span>
                <span className="ml-2 font-medium text-foreground">
                  {selected.product.cost != null
                    ? numberFormatter.format(selected.product.cost)
                    : "—"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-foreground-muted">{t("history.detail.stats.firstSale")}:</span>
                <span className="ml-2 font-medium text-foreground">
                  {selected.product.first_sale_month ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <MinimalChart
            labels={selected.months.map((month) => formatLabel(month, locale))}
            predicted={selected.y_pred}
            actual={selected.y_true ?? undefined}
          />

          {selected.id ? (
            <a
              href={`/api/export?forecastId=${selected.id}`}
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-border/60 px-5 py-2 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              {t("common.csvDownload")}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
