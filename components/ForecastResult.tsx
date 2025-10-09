"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
import MinimalChart from "./MinimalChart";
import { cardClassName, headingClassName, subtleTextClassName } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/client";

type ForecastResultData = {
  forecastId?: string;
  model: "lgbm_full" | "lgbm_meta";
  horizon: number;
  used_model?: boolean;
  y_pred: number[];
  y_true?: number[] | null;
  months: string[];
  summary?: string | null;
};

type ForecastResultProps = {
  data: ForecastResultData;
  onSave?: () => Promise<void> | void;
  onDownload?: () => Promise<void> | void;
  isSaving?: boolean;
  isDownloading?: boolean;
  statusMessage?: string | null;
  insight?: string | null;
  isInsightStreaming?: boolean;
};

function formatMonthLabel(month: string, locale: string) {
  const parsed = new Date(month.length === 7 ? `${month}-01` : month);
  if (!Number.isFinite(parsed.getTime())) return month;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
    }).format(parsed);
  } catch {
    return month;
  }
}

export default function ForecastResult({
  data,
  onSave,
  onDownload,
  isSaving,
  isDownloading,
  statusMessage,
  insight,
  isInsightStreaming,
}: ForecastResultProps) {
  const { t, language } = useTranslation();
  const locale = language === "th" ? "th-TH" : "en-US";
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const labels = data.months.map((month) => formatMonthLabel(month, locale));
  const actualValues = data.y_true ?? undefined;
  const modelName =
    data.model === "lgbm_full"
      ? t("models.historicalFull")
      : t("models.metadataFull");
  const horizonLabel = t("common.monthsLabel", { count: data.horizon });
  const separator = t("forecastResult.modelSummary.separator");
  const displayedInsight = (insight ?? data.summary ?? "").trim();

  return (
    <section className={clsx(cardClassName, "mt-10 flex flex-col gap-8 p-8")}> 
      <header className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div>
          <h2 className={headingClassName}>{t("forecastResult.heading")}</h2>
          <div className="flex items-center gap-2">
            <p className={subtleTextClassName}>
              {modelName}
              {separator}
              {horizonLabel}
            </p>
            {data.used_model !== undefined && (
              <span
                className={clsx(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  data.used_model
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                )}
              >
                {data.used_model
                  ? t("forecastResult.badges.live")
                  : t("forecastResult.badges.heuristic")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onSave?.()}
            disabled={!onSave || isSaving}
            className={clsx(
              "rounded-full border px-5 py-2 text-sm font-medium transition",
              onSave
                ? "border-accent bg-accent/10 text-foreground hover:bg-accent/20"
                : "border-border/60 text-foreground-muted",
              isSaving && "cursor-wait opacity-70"
            )}
          >
            {isSaving
              ? t("forecastResult.buttons.saving")
              : t("forecastResult.buttons.save")}
          </button>
          {data.forecastId ? (
            <a
              href={`/api/export?forecastId=${data.forecastId}`}
              className="rounded-full border border-border/70 px-5 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-foreground"
            >
              {t("forecastResult.buttons.download")}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onDownload?.()}
              disabled={!onDownload || isDownloading}
              className={clsx(
                "rounded-full border px-5 py-2 text-sm font-medium transition",
                onDownload
                  ? "border-border/70 text-foreground hover:border-accent"
                  : "border-border/40 text-foreground-muted",
                isDownloading && "cursor-wait opacity-70"
              )}
            >
              {isDownloading
                ? t("forecastResult.buttons.preparing")
                : t("forecastResult.buttons.download")}
            </button>
          )}
        </div>
      </header>

      {statusMessage ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
          {statusMessage}
        </div>
      ) : null}

      {(displayedInsight || isInsightStreaming) && (
        <div className="relative rounded-3xl border border-border/70 bg-surface py-5 pl-6 pr-5 shadow-[0_15px_40px_rgba(31,27,23,0.08)]">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-foreground/60">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>{t("forecastResult.insightHeading")}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {displayedInsight || ""}
            {isInsightStreaming ? <span className="animate-pulse"> ▍</span> : null}
          </p>
          {!displayedInsight && isInsightStreaming ? (
            <p className="mt-2 text-xs text-foreground-muted">
              {t("forecastResult.insightLoading")}
            </p>
          ) : null}
        </div>
      )}

      <MinimalChart labels={labels} predicted={data.y_pred} actual={actualValues} />

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-surface-hover/60 text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("forecastResult.table.month")}</th>
              <th className="px-4 py-3 font-medium">{t("forecastResult.table.forecastQty")}</th>
              {actualValues ? (
                <th className="px-4 py-3 font-medium">
                  {t("forecastResult.table.actualQty")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, idx) => (
              <tr key={label} className="border-t border-border/50">
                <td className="px-4 py-3 text-foreground-muted">{label}</td>
                <td className="px-4 py-3 font-medium">
                  {numberFormatter.format(Math.round(data.y_pred[idx]))}
                </td>
                {actualValues ? (
                  <td className="px-4 py-3 text-foreground-muted">
                    {actualValues[idx] != null
                      ? numberFormatter.format(Math.round(actualValues[idx]!))
                      : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
