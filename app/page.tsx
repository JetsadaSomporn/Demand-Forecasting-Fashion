import Link from "next/link";
import { ArrowRight } from "lucide-react";
import InteractiveTitle from "@/components/InteractiveTitle";
import Navigation from "@/components/Navigation";
import { getServerTranslator } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Cache landing page for 5 minutes
export const revalidate = 300;

export default async function LandingPage() {
  const translator = await getServerTranslator();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user && !userError);
  const accountLabel = isAuthenticated
    ? (user?.user_metadata?.full_name as string | undefined) ??
      user?.email ??
      translator.t("common.accountFallback")
    : translator.t("common.guestLabel");

  const navItems = [
    { href: "/forecast", label: translator.t("nav.forecast") },
    { href: "/history", label: translator.t("nav.history") },
    { href: "/settings", label: translator.t("nav.settings") },
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-white">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/media/hero.mp4" type="video/mp4" />
      </video>
      <div className="theme-linear-overlay absolute inset-0" aria-hidden />
      <div className="theme-radial-overlay absolute inset-0" aria-hidden />

      <header className="relative z-20 flex w-full items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-display text-lg tracking-[0.4em] uppercase text-white">
          {translator.t("common.brand")}
        </Link>
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Navigation items={navItems} />
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <span className="whitespace-nowrap text-[13px]">
            {accountLabel}
          </span>
          <Link
            href={isAuthenticated ? "/logout" : "/login"}
            prefetch={false}
            className="text-[11px] uppercase tracking-[0.35em] text-white transition hover:text-accent"
          >
            {translator.t(isAuthenticated ? "common.signOut" : "common.signIn")}
          </Link>
        </div>
      </header>
      <div className="relative z-20 md:hidden px-6 pb-4">
        <div className="overflow-x-auto scrollbar-hide">
          <Navigation items={navItems} />
        </div>
      </div>

      <main className="relative z-10 mx-auto flex flex-1 w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 pb-16 pt-40 text-center md:pt-48">
        <InteractiveTitle title="Forecast" />
        <p className="max-w-2xl text-lg leading-relaxed text-white/85">
          {translator.language === "th"
            ? "ที่ที่คลื่นลูกใหม่ของการพยากรณ์ความต้องการกำลังก่อตัวขึ้น"
            : "Where the next wave of storytelling-grade forecasting comes to life."}
        </p>
        <Link
          href="/forecast"
          className="inline-flex min-w-[190px] items-center justify-center rounded-full bg-transparent px-10 py-4 text-xs font-semibold uppercase tracking-[0.32em] text-white/90 shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition duration-300 hover:-translate-y-0.5 hover:text-white supports-[backdrop-filter]:bg-white/12 backdrop-blur supports-[backdrop-filter]:backdrop-blur-xl"
        >
          {translator.language === "th" ? "เริ่มสร้าง Forecast" : "Create Forecast"}
        </Link>
        <Link
          href="/settings"
          className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-white/75 transition hover:text-white"
        >
          {translator.language === "th" ? "สำรวจการตั้งค่า" : "Explore settings"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/history"
          className="mt-2 text-[11px] uppercase tracking-[0.4em] text-white/65 transition hover:text-white"
        >
          {translator.language === "th" ? "ดูประวัติทั้งหมด" : "View history"}
        </Link>
      </main>
    </div>
  );
}
