"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
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

type InsightCacheEntry = {
  summary: string;
  language: "en" | "th";
  timestamp: string | null;
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

  const [insightCache, setInsightCache] = useState<Record<string, InsightCacheEntry>>({});
  const [selected, setSelected] = useState<ForecastDetail | undefined>(
    defaultEntry
  );
  const [insight, setInsight] = useState<string>(defaultEntry?.summary ?? "");
  const [summaryTimestamp, setSummaryTimestamp] = useState<string | null>(
    defaultEntry?.summary_created_at ?? null
  );
  const [isInsightStreaming, setIsInsightStreaming] = useState(false);

  useEffect(() => {
    if (!selected) {
      setInsight("");
      setSummaryTimestamp(null);
      setIsInsightStreaming(false);
      return;
    }

    const storedSummary = selected.summary ?? "";
    const storedTimestamp = selected.summary_created_at ?? null;
    const matchesLanguage =
      Boolean(storedSummary.trim()) && selected.summary_language === language;

    const cached = insightCache[selected.id];
    const languageCode: "en" | "th" = language === "th" ? "th" : "en";

    if (cached && cached.language === languageCode) {
      setInsight(cached.summary);
      setSummaryTimestamp(cached.timestamp ?? null);
      setIsInsightStreaming(false);
      return;
    }

    if (matchesLanguage) {
      setInsight(storedSummary);
      setSummaryTimestamp(storedTimestamp);
      setIsInsightStreaming(false);
      setInsightCache((prev) => {
        const existing = prev[selected.id];
        if (
          existing &&
          existing.language === languageCode &&
          existing.summary === storedSummary &&
          existing.timestamp === storedTimestamp
        ) {
          return prev;
        }
        return {
          ...prev,
          [selected.id]: {
            summary: storedSummary,
            language: languageCode,
            timestamp: storedTimestamp,
          },
        };
      });
      return;
    }

    setInsight(storedSummary);
    setSummaryTimestamp(storedTimestamp);

    if (!selected.id) {
      setIsInsightStreaming(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        setIsInsightStreaming(true);
        const response = await fetch(
          `/api/forecast/${selected.id}/insight?lang=${languageCode}`,
          { signal: controller.signal }
        );

        if (!response.ok || !response.body) {
          throw new Error("Insight request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          if (!cancelled) {
            setInsight(buffer);
          }
        }

        if (!cancelled) {
          const finalSummary = buffer.trim();
          setInsight(finalSummary);
          const timestamp = new Date().toISOString();
          setSummaryTimestamp(timestamp);
          setInsightCache((prev) => ({
            ...prev,
            [selected.id]: {
              summary: finalSummary,
              language: languageCode,
              timestamp,
            },
          }));
          setSelected((prev) => {
            if (!prev || prev.id !== selected.id) return prev;
            if (
              prev.summary === finalSummary &&
              prev.summary_language === languageCode &&
              prev.summary_created_at === timestamp
            ) {
              return prev;
            }
            return {
              ...prev,
              summary: finalSummary,
              summary_language: languageCode,
              summary_created_at: timestamp,
            };
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[HistoryTable] Insight stream error:", error);
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
  }, [selected, language, insightCache]);

  return (
    <div className="min-h-screen bg-white py-24 px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 space-y-2 text-left">
          <h1 className="text-[13px] font-bold uppercase tracking-[0.35em] text-gray-900">
            {t("nav.history")}
          </h1>
          <p className="max-w-xl text-xs leading-relaxed text-gray-600">
            {t("history.table.description")}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[28px] border-2 border-gray-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-700">{t("history.table.skuTitle")}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-700">{t("history.table.model")}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-700">{t("history.table.horizon")}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-700">{t("history.table.created")}</th>
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
                    "cursor-pointer border-t border-gray-200 transition",
                    isActive
                      ? "bg-blue-50 text-gray-900"
                      : "hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">
                        {entry.product.title ?? entry.product.sku ?? t("dashboard.fallbackSku")}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-gray-600">
                        {entry.product.category ?? "–"} · {entry.product.color ?? "–"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {entry.model_name === "lgbm_full"
                      ? t("models.historicalShort")
                      : t("models.metadataShort")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {t("common.horizon", { count: entry.horizon })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatCreatedAt(entry.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="flex flex-col gap-6 rounded-[28px] border-2 border-gray-200 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <header className="space-y-2 border-b border-gray-200 pb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900">
              {selected.product.title ?? selected.product.sku ?? t("history.detail.fallbackTitle")}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-600">
              {selected.model_name === "lgbm_full"
                ? t("models.historicalShort")
                : t("models.metadataShort")}
              {" · "}
              {t("common.horizon", { count: selected.horizon })}
            </p>
          </header>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">{t("history.detail.stats.category")}:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {selected.product.category ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">{t("history.detail.stats.color")}:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {selected.product.color ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">{t("history.detail.stats.sizes")}:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {selected.product.sizes ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">{t("history.detail.stats.cost")}:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {selected.product.cost != null
                    ? numberFormatter.format(selected.product.cost)
                    : "—"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">{t("history.detail.stats.firstSale")}:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {selected.product.first_sale_month ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 px-5 py-5 shadow-sm">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-foreground/60">
              <Sparkles className="h-4 w-4 text-accent" />
              <span>{t("history.detail.insightHeading")}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {insight.trim() ? insight : t("history.detail.insightEmpty")}
              {isInsightStreaming ? <span className="animate-pulse"> ▍</span> : null}
            </p>
            {summaryTimestamp ? (
              <p className="mt-2 text-xs text-foreground-muted">
                {formatCreatedAt(summaryTimestamp)}
              </p>
            ) : null}
          </div>

          <MinimalChart
            labels={selected.months.map((month) => formatLabel(month, locale))}
            predicted={selected.y_pred}
            actual={selected.y_true ?? undefined}
          />

          {selected.id ? (
            <a
              href={`/api/export?forecastId=${selected.id}`}
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border-2 border-blue-600 bg-blue-600 px-6 py-3 text-xs font-bold uppercase tracking-[0.3em] shadow-[0_8px_16px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:border-blue-700"
              style={{ color: '#FFFFFF' }}
            >
              {t("common.csvDownload")}
            </a>
          ) : null}
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}
