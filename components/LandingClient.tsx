"use client";

import React from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { useTranslation } from "@/lib/i18n/client";
import InteractiveTitle from "@/components/InteractiveTitle";

type LandingClientProps = {
  navItems: { href: string; label: string }[];
  accountLabel: string;
  isAuthenticated: boolean;
};

export default function LandingClient({
  navItems,
  accountLabel,
  isAuthenticated,
}: LandingClientProps) {
  const { t, language } = useTranslation();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-blue-500/30">
      
      {/* Fixed Background Video with Heavy Overlay */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
        {/* Dark Overlay for Contrast */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 z-50 flex w-full items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-sm tracking-[0.2em] uppercase text-white/90 hover:text-white transition-colors">
          {t("common.brand")}
        </Link>
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Navigation items={navItems} />
        </div>
        <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.2em]">
          <span className="hidden sm:inline text-white/70">{accountLabel}</span>
          <Link
            href={isAuthenticated ? "/logout" : "/login"}
            prefetch={false}
            className="hover:text-white text-white/60 transition-colors"
          >
            {t(isAuthenticated ? "common.signOut" : "common.signIn")}
          </Link>
        </div>
      </header>

      {/* Main Hero Content - Centered */}
      <main className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-1000">
          
          <InteractiveTitle title="Forecast" />
          
          <p className="max-w-xl text-lg md:text-2xl font-light text-white/80 leading-relaxed tracking-wide">
            {language === "th"
              ? "อนาคตของการพยากรณ์ อยู่ในมือคุณ"
              : "The future of demand forecasting. Redefined."}
          </p>
          
          <div className="mt-4 flex items-center gap-6">
             <Link
              href="/forecast"
              className="group relative inline-flex h-[44px] min-w-[160px] items-center justify-center rounded-full bg-blue-600 px-8 text-sm font-medium text-white transition-all hover:bg-blue-500 hover:scale-105 shadow-[0_0_40px_rgba(37,99,235,0.4)]"
            >
              {language === "th" ? "เริ่มต้น" : "Get Started"}
            </Link>
             <Link
              href="/settings"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {language === "th" ? "เรียนรู้เพิ่มเติม >" : "Learn more >"}
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Footer - Fixed Bottom */}
      <footer className="absolute bottom-6 left-0 w-full z-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row items-center justify-between px-6 text-[11px] text-white/40">
          <div className="mb-2 md:mb-0">
            Copyright © 2025 Fashion Demand Forecast.
          </div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link href="#" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
