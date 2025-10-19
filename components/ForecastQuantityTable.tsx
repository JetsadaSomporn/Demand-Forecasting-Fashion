"use client";

import { useTranslation } from "@/lib/i18n/client";

type ForecastQuantityTableProps = {
  labels: string[];
  predicted: Array<number | null | undefined>;
  actual?: Array<number | null | undefined> | null;
  numberFormatter: Intl.NumberFormat;
};

function formatValue(
  value: number | null | undefined,
  formatter: Intl.NumberFormat
) {
  if (value == null) return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatter.format(Math.round(value));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return formatter.format(Math.round(parsed));
}

export default function ForecastQuantityTable({
  labels,
  predicted,
  actual,
  numberFormatter,
}: ForecastQuantityTableProps) {
  const { t } = useTranslation();
  const showActual = Array.isArray(actual);

  return (
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
            {showActual ? (
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
                {t("forecastResult.table.actualQty")}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, idx) => (
            <tr key={`${label}-${idx}`} className="border-t border-white/10">
              <td className="px-4 py-3 text-white/60">{label}</td>
              <td className="px-4 py-3 font-semibold text-white">
                {formatValue(predicted[idx], numberFormatter)}
              </td>
              {showActual ? (
                <td className="px-4 py-3 text-white/60">
                  {formatValue(actual?.[idx], numberFormatter)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
