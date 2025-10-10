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
    <div className="relative min-h-screen bg-gradient-to-b from-background via-surface/70 to-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/30 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="font-display text-lg tracking-[0.4em] uppercase text-foreground">
            {t("common.brand")}
          </Link>
          <div className="hidden flex-1 items-center justify-center md:flex">
            <Navigation items={navItems} />
          </div>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.35em] text-foreground/70">
            <span className="hidden rounded-full border border-border/80 bg-surface/80 px-4 py-2 text-foreground md:inline-block">
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
        <div className="md:hidden border-t border-border/30 bg-background/80 px-6 pb-4 pt-3">
          <div className="overflow-x-auto">
            <Navigation items={navItems} />
          </div>
        </div>
      </header>
      <main className="pt-0 pb-12 lg:pb-16">{children}</main>
    </div>
  );
}
