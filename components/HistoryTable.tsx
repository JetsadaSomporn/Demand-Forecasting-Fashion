"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
import MinimalChart from "./MinimalChart";
import type { ForecastDetail } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n/client";
import { normalizeCurrencyCode } from "@/lib/currency";

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
  defaultCurrency?: string | null;
};

type InsightCacheEntry = {
  summary: string;
  language: "en" | "th";
  timestamp: string | null;
};

export default function HistoryTable({ entries, initialId, defaultCurrency }: HistoryTableProps) {
  const { t, language } = useTranslation();
  const locale = language === "th" ? "th-TH" : "en-US";
  const fallbackCurrency = normalizeCurrencyCode(defaultCurrency);
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
  const costCurrency = normalizeCurrencyCode(selected?.product?.currency ?? fallbackCurrency);

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
    <div className="min-h-screen px-6 py-24 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 space-y-3 text-left">
          <h1 className="text-sm font-bold uppercase tracking-[0.35em] text-white/75">
            {t("nav.history")}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/60">
            {t("history.table.description")}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/12 shadow-[0_40px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <table className="w-full border-separate border-spacing-0 text-left text-sm text-white/80">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.table.skuTitle")}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.table.model")}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.table.horizon")}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.table.created")}</th>
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
                    "cursor-pointer border-t border-white/10 transition",
                    isActive
                      ? "bg-white/20 text-white"
                      : "hover:bg-white/5"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">
                        {entry.product.title ?? entry.product.sku ?? t("dashboard.fallbackSku")}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                        {entry.product.category ?? "–"} · {entry.product.color ?? "–"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {entry.model_name === "lgbm_full"
                      ? t("models.historicalShort")
                      : t("models.metadataShort")}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {t("common.horizon", { count: entry.horizon })}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {formatCreatedAt(entry.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="flex flex-col gap-6 rounded-xl border border-white/10 bg-white/12 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <header className="space-y-2 border-b border-white/10 pb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-white">
              {selected.product.title ?? selected.product.sku ?? t("history.detail.fallbackTitle")}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">
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
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.detail.stats.category")}:</span>
                <span className="ml-2 font-semibold text-white">
                  {selected.product.category ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.detail.stats.color")}:</span>
                <span className="ml-2 font-semibold text-white">
                  {selected.product.color ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.detail.stats.sizes")}:</span>
                <span className="ml-2 font-semibold text-white">
                  {selected.product.sizes ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
                  {t("history.detail.stats.cost", { currency: costCurrency })}:
                </span>
                <span className="ml-2 font-semibold text-white">
                  {selected.product.cost != null
                    ? `${costCurrency} ${numberFormatter.format(selected.product.cost)}`
                    : "—"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t("history.detail.stats.firstSale")}:</span>
                <span className="ml-2 font-semibold text-white">
                  {selected.product.first_sale_month ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/8 px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-white/60">
              <Sparkles className="h-4 w-4 text-white" />
              <span>{t("history.detail.insightHeading")}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {insight.trim() ? insight : t("history.detail.insightEmpty")}
              {isInsightStreaming ? <span className="animate-pulse"> ▍</span> : null}
            </p>
            {summaryTimestamp ? (
              <p className="mt-2 text-xs text-white/50">
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
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-transparent px-6 py-3 text-xs font-bold uppercase tracking-[0.3em] text-white shadow-[0_18px_32px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:text-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/15 supports-[backdrop-filter]:backdrop-blur-lg"
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
