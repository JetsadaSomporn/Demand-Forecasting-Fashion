import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LineChart, Sparkles } from "lucide-react";
import { getRecentForecasts } from "@/lib/queries";
import { getServerTranslator } from "@/lib/i18n/server";
import { cardClassName, headingClassName, subtleTextClassName } from "@/lib/theme";

function formatTimestamp(timestamp: string, formatter: Intl.DateTimeFormat) {
  try {
    return formatter.format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

export default async function DashboardPage() {
  const recentForecasts = await getRecentForecasts(4);
  const { t, language } = await getServerTranslator();
  const locale = language === "th" ? "th-TH" : "en-US";
  const timestampFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const heroImageSrc =
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1600&q=80";
  const editorialImageSrc =
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80";

  const leadForecast = recentForecasts[0];
  const leadModelLabel =
    leadForecast?.model_name === "lgbm_full" ? t("models.historicalShort") : t("models.metadataShort");
  const leadTitle =
    leadForecast?.product.title ?? leadForecast?.product.sku ?? t("history.emptyTitle");
  const leadMeta = leadForecast
    ? `${leadForecast.product.category ?? "–"} · ${leadForecast.product.color ?? "–"}`
    : t("history.emptyTitle");
  const leadHorizon = leadForecast
    ? t("common.horizon", { count: leadForecast.horizon })
    : t("common.horizon", { count: 6 });
  const leadTimestamp = leadForecast ? formatTimestamp(leadForecast.created_at, timestampFormatter) : null;

  return (
    <div className="flex flex-col gap-12 lg:gap-16">
      <section className="relative overflow-hidden rounded-[40px] border border-border/80 bg-black">
        <Image
          src={heroImageSrc}
          alt="Runway models walking during a presentation"
          fill
          sizes="(min-width: 1280px) 1100px, 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#14100d] via-[#1d1612]/85 to-transparent" />
        <div className="relative z-10 grid gap-10 px-8 py-16 sm:px-12 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)] lg:px-20 xl:px-24">
          <div className="flex flex-col gap-6 text-white">
            <div className="inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.4em] text-white/70">
              <Sparkles className="h-4 w-4 text-white/80" />
              <span>{t("dashboard.heroBadge")}</span>
            </div>
            <h1 className="font-display text-[clamp(3rem,6vw,4.6rem)] uppercase leading-[1.05]">
              Forecast Capsule Studio
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
              {t("dashboard.heroDescription")}
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/forecast"
                className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-3 text-xs font-medium uppercase tracking-[0.35em] text-foreground !text-[var(--color-foreground)] transition hover:-translate-y-0.5 hover:bg-accent hover:text-white"
              >
                {t("dashboard.primaryAction")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/history"
                className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/20 px-7 py-3 text-xs font-medium uppercase tracking-[0.35em] text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white hover:bg-white/30"
              >
                {t("dashboard.secondaryAction")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.35em] text-white/60">
              <span>FW25 Exclusive Window</span>
              <span aria-hidden>•</span>
              <span>{leadTimestamp ?? t("history.emptyTitle")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-5 rounded-[28px] border border-white/20 bg-white/10 p-6 text-white backdrop-blur-md sm:p-8">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/70">
              <span>{t("dashboard.selectionTitle")}</span>
              {leadTimestamp ? <span>{leadTimestamp}</span> : null}
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">{leadMeta}</p>
              <h2 className="font-display text-3xl uppercase leading-tight">{leadTitle}</h2>
            </div>
            <div className="rounded-[20px] border border-white/20 bg-black/30 p-5 text-xs uppercase tracking-[0.35em] text-white/80">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <LineChart className="h-4 w-4 text-white" />
                  <span>{leadModelLabel}</span>
                </div>
                <span>{leadHorizon}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/60">
              <span>{leadTimestamp ?? t("history.emptyTitle")}</span>
              <span>{leadHorizon}</span>
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.35em] text-white transition hover:text-accent"
            >
              {t("dashboard.browseHistory")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
        <div className={`${cardClassName} flex flex-col gap-8 p-8 sm:p-10`}>
          <div className="space-y-3">
            <h2 className="font-display text-3xl uppercase tracking-[0.2em] text-foreground">
              {t("dashboard.selectionTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-foreground-muted">
              {t("dashboard.selectionDescription")}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-[22px] border border-border/60 bg-surface-hover/60 p-6">
              <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/50">
                {t("models.historicalShort")}
              </p>
              <h3 className="mt-3 font-display text-2xl uppercase tracking-[0.18em] text-foreground">
                {t("models.historicalFull")}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
                {t("models.historicalDetail")}
              </p>
            </div>
            <div className="rounded-[22px] border border-border/60 bg-surface-hover/60 p-6">
              <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/50">
                {t("models.metadataShort")}
              </p>
              <h3 className="mt-3 font-display text-2xl uppercase tracking-[0.18em] text-foreground">
                {t("models.metadataFull")}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
                {t("models.metadataDetail")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.35em] text-foreground/60">
            <span>Auto-switch logic</span>
            <span aria-hidden>•</span>
            <span>Supabase authenticated workspace</span>
          </div>
        </div>
        <div className={`${cardClassName} relative overflow-hidden p-0`}>
          <Image
            src={editorialImageSrc}
            alt="Editorial campaign model"
            fill
            sizes="(min-width: 1024px) 380px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c0a] via-[#0f0c0a]/45 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-8 text-white">
            <span className="text-[11px] uppercase tracking-[0.35em] text-white/70">New in</span>
            <h3 className="font-display text-3xl uppercase leading-tight">Editorial History Archive</h3>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.35em] text-white transition hover:text-accent"
            >
              {t("dashboard.browseHistory")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className={headingClassName}>{t("dashboard.latestTitle")}</h2>
            <p className={subtleTextClassName}>{t("dashboard.latestSubtitle")}</p>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.35em] text-foreground transition hover:text-accent"
          >
            {t("dashboard.browseHistory")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recentForecasts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {recentForecasts.map((forecast) => {
              const modelLabel =
                forecast.model_name === "lgbm_full"
                  ? t("models.historicalShort")
                  : t("models.metadataShort");
              const title =
                forecast.product.title ?? forecast.product.sku ?? t("dashboard.fallbackSku");
              const meta = `${forecast.product.category ?? "–"} · ${forecast.product.color ?? "–"}`;
              const timestamp = formatTimestamp(forecast.created_at, timestampFormatter);
              return (
                <Link
                  key={forecast.id}
                  href={`/history?focus=${forecast.id}`}
                  className="group relative flex h-full flex-col gap-8 overflow-hidden rounded-[28px] border border-border/80 bg-surface/95 px-6 py-7 transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_30px_60px_rgba(176,123,86,0.18)]"
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-foreground/60">
                    <span>{modelLabel}</span>
                    <span>{timestamp}</span>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-display text-2xl uppercase leading-tight text-foreground">
                      {title}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.35em] text-foreground-muted">{meta}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-foreground/70">
                    <span className="rounded-full border border-border px-3 py-1">
                      {t("common.horizon", { count: forecast.horizon })}
                    </span>
                    <span>{timestamp}</span>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.35em] text-accent transition group-hover:translate-x-1">
                    {t("dashboard.chartLink")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={`${cardClassName} flex flex-col items-center gap-3 p-12 text-center`}>
            <h3 className="font-display text-3xl uppercase leading-tight text-foreground">
              {t("history.emptyTitle")}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
              {t("history.emptyDescription")}
            </p>
            <Link
              href="/forecast"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-foreground px-6 py-2 text-xs font-medium uppercase tracking-[0.35em] text-foreground transition hover:bg-foreground hover:text-background"
            >
              {t("dashboard.primaryAction")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
