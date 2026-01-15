"use client";

import React, { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTranslation } from "@/lib/i18n/client";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

type MinimalChartProps = {
  labels: string[];
  predicted: number[];
  actual?: number[] | null;
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        color: "#e5e7eb",
        usePointStyle: true,
        boxWidth: 12,
      },
    },
    tooltip: {
      mode: "index" as const,
      intersect: false,
      backgroundColor: "rgba(10,10,13,0.92)",
      displayColors: false,
      padding: 12,
      titleColor: "#e5e7eb",
      bodyColor: "#e5e7eb",
      borderColor: "#1f2937",
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: {
        color: "#9ca3af",
      },
      grid: {
        display: false,
      },
      border: {
        display: false,
      },
    },
    y: {
      ticks: {
        color: "#9ca3af",
        padding: 8,
      },
      grid: {
        display: false,
      },
      border: {
        display: false,
      },
    },
  },
};

function MinimalChart({ labels, predicted, actual }: MinimalChartProps) {
  const { t } = useTranslation();

  const safePredicted = useMemo(() => {
    return predicted
      .map((value) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => value != null);
  }, [predicted]);

  const labelSet = useMemo(() => {
    if (!safePredicted.length) return labels;
    if (safePredicted.length >= labels.length) {
      return labels.length ? labels : Array.from({ length: safePredicted.length }, (_, idx) => `M${idx + 1}`);
    }
    return labels.slice(0, safePredicted.length);
  }, [labels, safePredicted]);

  const trimmedPredicted = useMemo(() => {
    if (!safePredicted.length) return [];
    if (safePredicted.length > labelSet.length) {
      return safePredicted.slice(0, labelSet.length);
    }
    return safePredicted;
  }, [labelSet, safePredicted]);

  const safeActual = useMemo(() => {
    if (!actual) return undefined;
    const sanitized = actual
      .map((value) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => value != null);
    if (!sanitized.length) return undefined;
    return sanitized.slice(0, labelSet.length);
  }, [actual, labelSet]);

  const datasets = useMemo(() => {
    const base = [
      {
        label: t("forecastResult.table.forecastQty"),
        data: trimmedPredicted,
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96,165,250,0.18)",
        borderWidth: 2,
        tension: 0.45,
        pointRadius: 3,
        pointHoverRadius: 4,
        fill: false,
      },
    ];

    if (safeActual && safeActual.length) {
      base.push({
        label: t("forecastResult.table.actualQty"),
        data: safeActual,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(167,139,250,0.18)",
        borderWidth: 2,
        tension: 0.45,
        pointRadius: 3,
        pointHoverRadius: 4,
        fill: false,
      });
    }

    return base;
  }, [safeActual, t, trimmedPredicted]);

  const data = useMemo(
    () => ({
      labels: labelSet,
      datasets,
    }),
    [datasets, labelSet]
  );

  if (!trimmedPredicted.length) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-xl border border-border/60 bg-surface text-sm text-foreground-muted">
        {t("history.chart.noData")}
      </div>
    );
  }

  return (
    <div className="relative h-72 w-full">
      <Line options={chartOptions} data={data} />
    </div>
  );
}

export default React.memo(MinimalChart);
