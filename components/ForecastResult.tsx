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
    <section className="mt-10 flex flex-col gap-8 rounded-lg border-2 border-gray-200 bg-white p-8 shadow-sm"> 
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.35em] text-gray-900">
            {t("forecastResult.heading")}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm text-gray-600">
              {modelName}
              {separator}
              {horizonLabel}
            </p>
            {data.used_model !== undefined && (
              <span
                className={clsx(
                  "rounded px-2 py-0.5 text-xs font-semibold",
                  data.used_model
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
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
              "rounded border-2 px-5 py-2 text-sm font-bold uppercase tracking-wide transition",
              onSave
                ? "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-md"
                : "border-gray-100 text-gray-400",
              isSaving && "cursor-wait opacity-70"
            )}
            style={onSave && !isSaving ? { color: '#000000' } : undefined}
          >
            {isSaving
              ? t("forecastResult.buttons.saving")
              : t("forecastResult.buttons.save")}
          </button>
          {data.forecastId ? (
            <a
              href={`/api/export?forecastId=${data.forecastId}`}
              className="rounded bg-blue-600 px-5 py-2 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-blue-700 hover:shadow-md"
              style={{ color: '#FFFFFF' }}
            >
              {t("forecastResult.buttons.download")}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onDownload?.()}
              disabled={!onDownload || isDownloading}
              className={clsx(
                "rounded px-5 py-2 text-sm font-bold uppercase tracking-wide transition",
                onDownload
                  ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md"
                  : "bg-gray-100 text-gray-400",
                isDownloading && "cursor-wait opacity-70"
              )}
              style={onDownload && !isDownloading ? { color: '#FFFFFF' } : undefined}
            >
              {isDownloading
                ? t("forecastResult.buttons.preparing")
                : t("forecastResult.buttons.download")}
            </button>
          )}
        </div>
      </header>

      {statusMessage ? (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {statusMessage}
        </div>
      ) : null}

      {(displayedInsight || isInsightStreaming) && (
        <div className="relative rounded-lg border-2 border-gray-200 bg-white py-5 pl-6 pr-5 shadow-sm">
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.35em] text-gray-600">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>{t("forecastResult.insightHeading")}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
            {displayedInsight || ""}
            {isInsightStreaming ? <span className="animate-pulse"> ▍</span> : null}
          </p>
          {!displayedInsight && isInsightStreaming ? (
            <p className="mt-2 text-xs text-gray-500">
              {t("forecastResult.insightLoading")}
            </p>
          ) : null}
        </div>
      )}

      <MinimalChart labels={labels} predicted={data.y_pred} actual={actualValues} />

      <div className="overflow-hidden rounded-lg border-2 border-gray-200">
        <table className="w-full text-left text-sm text-gray-900">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-700">
                {t("forecastResult.table.month")}
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-700">
                {t("forecastResult.table.forecastQty")}
              </th>
              {actualValues ? (
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-700">
                  {t("forecastResult.table.actualQty")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, idx) => (
              <tr key={label} className="border-t border-gray-200">
                <td className="px-4 py-3 text-gray-600">{label}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {numberFormatter.format(Math.round(data.y_pred[idx]))}
                </td>
                {actualValues ? (
                  <td className="px-4 py-3 text-gray-600">
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
