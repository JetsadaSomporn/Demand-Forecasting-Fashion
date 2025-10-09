"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import Navigation from "./Navigation";
import { useTranslation } from "@/lib/i18n/client";

type AppShellProps = {
  children: ReactNode;
  user: {
    email?: string | null;
    displayName?: string | null;
  };
};

export default function AppShell({ children, user }: AppShellProps) {
  const { t } = useTranslation();
  const navItems = useMemo(
    () => [
      { href: "/forecast", label: t("nav.forecast") },
      { href: "/history", label: t("nav.history") },
      { href: "/settings", label: t("nav.settings") },
    ],
    [t]
  );

  const label = user.displayName || user.email || t("common.accountFallback");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-surface/70 to-background text-foreground">
      <div className="border-b border-border/60 bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2 text-[11px] uppercase tracking-[0.4em]">
          <span className="hidden sm:block">{t("dashboard.heroBadge")}</span>
          <span className="font-medium">Seasonal Insights · FW25 Preview</span>
        </div>
      </div>
      <header className="border-b border-border/70 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-6">
            <Link href="/" className="font-display text-xl tracking-[0.4em] uppercase text-foreground">
              {t("common.brand")}
            </Link>
            <Link
              href="/logout"
              className="text-[11px] uppercase tracking-[0.35em] text-foreground/60 transition hover:text-accent md:hidden"
            >
              {t("common.signOut")}
            </Link>
          </div>
          <div className="md:flex md:flex-1 md:justify-center">
            <Navigation items={navItems} />
          </div>
          <div className="hidden items-center gap-4 text-[11px] uppercase tracking-[0.35em] text-foreground/70 md:flex">
            <span className="rounded-full border border-border/80 bg-surface/70 px-4 py-2 text-foreground">
              {label}
            </span>
            <Link
              href="/logout"
              className="text-foreground transition hover:text-accent"
            >
              {t("common.signOut")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 lg:py-14">{children}</main>
    </div>
  );
}
