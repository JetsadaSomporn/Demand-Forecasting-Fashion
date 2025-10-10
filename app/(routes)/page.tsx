import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, LineChart, Sparkles } from "lucide-react";
import { getRecentForecasts } from "@/lib/queries";
import { getServerTranslator } from "@/lib/i18n/server";
import { headingClassName, subtleTextClassName } from "@/lib/theme";

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
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1800&q=80";
  const featureImages = {
    capsule:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1600&q=80",
    editorial:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
    studio:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80",
  };

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
  const heroTitle = leadForecast ? leadTitle : "Seasonless Demand Studio";

  const featureSections = [
    {
      label: "Seasonal Capsules",
      title: "Modular Release Planner",
      description: t("dashboard.selectionDescription"),
      href: "/forecast",
      cta: t("dashboard.primaryAction"),
      image: featureImages.capsule,
      imagePosition: "right" as const,
    },
    {
      label: leadMeta,
      title: leadTitle,
      description: t("dashboard.latestSubtitle"),
      href: leadForecast ? `/history?focus=${leadForecast.id}` : "/history",
      cta: t("dashboard.browseHistory"),
      image: featureImages.editorial,
      imagePosition: "left" as const,
    },
    {
      label: "Supply Guardrails",
      title: t("dashboard.selectionTitle"),
      description: t("dashboard.selectionDescription"),
      href: "/settings",
      cta: t("nav.settings"),
      image: featureImages.studio,
      imagePosition: "right" as const,
    },
  ];

  const runwayActions = [
    {
      href: "/forecast",
      label: t("dashboard.primaryAction"),
      description: t("models.historicalDetail"),
      icon: LineChart,
    },
    {
      href: "/history",
      label: t("dashboard.browseHistory"),
      description: t("dashboard.latestSubtitle"),
      icon: Sparkles,
    },
    {
      href: "/settings",
      label: t("nav.settings"),
      description: "Build guardrails for launch windows",
      icon: CalendarDays,
    },
  ];

  return (
    <div className="flex flex-col">
      <section className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-black text-white">
        <Image
          src={heroImageSrc}
          alt="Studio models showcasing the latest apparel capsule"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center sm:px-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/50 px-4 py-2 text-[11px] uppercase tracking-[0.4em] text-white/75">
            <Sparkles className="h-4 w-4" />
            Atelier Insight
          </span>
          <h1 className="font-display text-[clamp(3.5rem,7vw,5.5rem)] tracking-[0.18em] text-white">
            {heroTitle}
          </h1>
          <p className="text-base leading-relaxed text-white/80">
            {t("dashboard.heroDescription")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/forecast"
              className="inline-flex min-w-[170px] items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-sm font-bold uppercase tracking-[0.28em] text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg"
            >
              {t("dashboard.primaryAction")}
            </Link>
            <Link
              href="/history"
              className="inline-flex min-w-[170px] items-center justify-center rounded-full border-2 border-white bg-white px-8 py-3 text-sm font-black uppercase tracking-[0.28em] shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:bg-gray-50"
              style={{ color: '#000000' }}
            >
              {t("dashboard.secondaryAction")}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] uppercase tracking-[0.35em] text-white/75">
            <span>{leadModelLabel}</span>
            <span aria-hidden>•</span>
            <span>{leadHorizon}</span>
            {leadTimestamp ? (
              <>
                <span aria-hidden>•</span>
                <span>{leadTimestamp}</span>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-24 bg-white py-20">
        {featureSections.map((feature, index) => {
          const imageElement = (
            <div className="w-full overflow-hidden rounded-[28px] bg-surface">
              <Image
                src={feature.image}
                alt={feature.title}
                width={960}
                height={640}
                className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
              />
            </div>
          );
          const textElement = (
            <div className="flex w-full flex-col gap-6 text-center lg:text-left">
              <span className="text-[11px] uppercase tracking-[0.35em] text-foreground/60">
                {feature.label}
              </span>
              <h2 className="font-display text-[clamp(2.2rem,4vw,3rem)] leading-tight text-foreground">
                {feature.title}
              </h2>
              <p className="text-base leading-relaxed text-foreground/70">{feature.description}</p>
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link
                  href={feature.href}
                  className="inline-flex min-w-[160px] items-center justify-center rounded-full border-2 border-blue-600 bg-blue-600 px-7 py-3 text-xs font-bold uppercase tracking-[0.3em] shadow-[0_18px_36px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:border-blue-700"
                  style={{ color: '#FFFFFF' }}
                >
                  {feature.cta}
                </Link>
                {index === 0 ? (
                  <Link
                    href="/history"
                    className="inline-flex min-w-[160px] items-center justify-center rounded-full border-2 border-gray-800 bg-white px-7 py-3 text-xs font-black uppercase tracking-[0.3em] shadow-[0_12px_28px_rgba(31,27,23,0.18)] transition hover:-translate-y-0.5 hover:border-gray-900 hover:bg-gray-50"
                    style={{ color: '#000000' }}
                  >
                    {t("dashboard.browseHistory")}
                  </Link>
                ) : null}
              </div>
            </div>
          );
          return (
            <div
              key={feature.title}
              className="mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 lg:grid lg:grid-cols-2 lg:gap-16"
            >
              {feature.imagePosition === "left" ? (
                <>
                  {imageElement}
                  {textElement}
                </>
              ) : (
                <>
                  {textElement}
                  {imageElement}
                </>
              )}
            </div>
          );
        })}
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-[13px] uppercase tracking-[0.35em] text-foreground/70">
            {t("dashboard.selectionTitle")}
          </h3>
          <div className="flex flex-wrap gap-4 text-[12px] uppercase tracking-[0.3em] text-foreground/60">
            {runwayActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group inline-flex items-center gap-3 rounded-full border-2 border-gray-800 bg-white px-5 py-3 transition hover:-translate-y-0.5 hover:border-blue-600 hover:shadow-md"
                >
                  <Icon className="h-4 w-4 transition group-hover:text-blue-600" style={{ color: '#1F2937' }} />
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] group-hover:text-blue-600" style={{ color: '#000000' }}>
                      {action.label}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: '#374151' }}>
                      {action.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto w-full max-w-7xl space-y-6 px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className={headingClassName}>{t("dashboard.latestTitle")}</h2>
              <p className={subtleTextClassName}>{t("dashboard.latestSubtitle")}</p>
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-foreground transition hover:text-accent"
            >
              {t("dashboard.browseHistory")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {recentForecasts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {recentForecasts.map((forecast) => {
                const modelLabel =
                  forecast.model_name === "lgbm_full" ? t("models.historicalShort") : t("models.metadataShort");
                const title =
                  forecast.product.title ?? forecast.product.sku ?? t("dashboard.fallbackSku");
                const meta = `${forecast.product.category ?? "–"} · ${forecast.product.color ?? "–"}`;
                const timestamp = formatTimestamp(forecast.created_at, timestampFormatter);
                return (
                  <Link
                    key={forecast.id}
                    href={`/history?focus=${forecast.id}`}
                    className="group flex h-full flex-col gap-5 rounded-[24px] border border-border/60 bg-white px-6 py-7 transition hover:-translate-y-1 hover:border-foreground/40 hover:shadow-[0_24px_56px_rgba(31,27,23,0.12)]"
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-foreground/50">
                      <span>{modelLabel}</span>
                      <span>{timestamp}</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-display text-[clamp(1.3rem,2.2vw,1.9rem)] uppercase leading-tight text-foreground">
                        {title}
                      </h3>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-foreground/50">{meta}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-foreground/60">
                      <span className="rounded-full border border-border px-3 py-1">
                        {t("common.horizon", { count: forecast.horizon })}
                      </span>
                      <span>{timestamp}</span>
                    </div>
                    <span className="inline-flex items-center gap-2 pt-2 text-xs font-medium uppercase tracking-[0.3em] text-accent transition group-hover:translate-x-1">
                      {t("dashboard.chartLink")}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-border bg-white p-12 text-center">
              <h3 className="font-display text-3xl uppercase leading-tight text-foreground">
                {t("history.emptyTitle")}
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-foreground/60">
                {t("history.emptyDescription")}
              </p>
              <Link
                href="/forecast"
                className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-gray-900 bg-gray-900 px-6 py-2 text-xs font-bold uppercase tracking-[0.3em] transition hover:bg-gray-800 hover:border-gray-800"
                style={{ color: '#FFFFFF' }}
              >
                {t("dashboard.primaryAction")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
