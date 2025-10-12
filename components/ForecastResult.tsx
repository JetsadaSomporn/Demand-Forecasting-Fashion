"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
import MinimalChart from "./MinimalChart";
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
    <section className="mt-14 flex flex-col gap-8 rounded-[32px] border border-white/10 bg-white/10 p-8 text-white shadow-[0_40px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.35em] text-white/75">
            {t("forecastResult.heading")}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm text-white/60">
              {modelName}
              {separator}
              {horizonLabel}
            </p>
            {data.used_model !== undefined && (
              <span
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.25em]",
                  data.used_model
                    ? "bg-emerald-400/15 text-emerald-200"
                    : "bg-amber-400/20 text-amber-200"
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
              "rounded-full border px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] transition",
              onSave
                ? "border-white/20 bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/20"
                : "border-white/10 text-white/30",
              isSaving && "cursor-wait opacity-60"
            )}
          >
            {isSaving
              ? t("forecastResult.buttons.saving")
              : t("forecastResult.buttons.save")}
          </button>
          {data.forecastId ? (
            <a
              href={`/api/export?forecastId=${data.forecastId}`}
              className="rounded-full border border-white bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] text-black transition hover:-translate-y-0.5 hover:bg-white/90"
            >
              {t("forecastResult.buttons.download")}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onDownload?.()}
              disabled={!onDownload || isDownloading}
              className={clsx(
                "rounded-full px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] transition",
                onDownload
                  ? "border border-white bg-white text-black hover:-translate-y-0.5 hover:bg-white/90"
                  : "border border-white/10 text-white/30",
                isDownloading && "cursor-wait opacity-60"
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
        <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-white/80">
          {statusMessage}
        </div>
      ) : null}

      {(displayedInsight || isInsightStreaming) && (
        <div className="relative rounded-[28px] border border-white/20 bg-white/10 py-6 pl-6 pr-5 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.35em] text-white/60">
            <Sparkles className="h-4 w-4 text-white" />
            <span>{t("forecastResult.insightHeading")}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
            {displayedInsight || ""}
            {isInsightStreaming ? <span className="animate-pulse"> ▍</span> : null}
          </p>
          {!displayedInsight && isInsightStreaming ? (
            <p className="mt-2 text-xs text-white/50">
              {t("forecastResult.insightLoading")}
            </p>
          ) : null}
        </div>
      )}

      <MinimalChart labels={labels} predicted={data.y_pred} actual={actualValues} />

      <div className="overflow-hidden rounded-[28px] border border-white/20 bg-white/5">
        <table className="w-full text-left text-sm text-white/80">
          <thead className="bg-white/10">
            <tr>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
                {t("forecastResult.table.month")}
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
                {t("forecastResult.table.forecastQty")}
              </th>
              {actualValues ? (
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
                  {t("forecastResult.table.actualQty")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, idx) => (
              <tr key={label} className="border-t border-white/10">
                <td className="px-4 py-3 text-white/60">{label}</td>
                <td className="px-4 py-3 font-semibold text-white">
                  {numberFormatter.format(Math.round(data.y_pred[idx]))}
                </td>
                {actualValues ? (
                  <td className="px-4 py-3 text-white/60">
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
