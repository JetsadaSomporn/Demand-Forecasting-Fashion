import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n/server";
import { ArrowRight } from "lucide-react";
import InteractiveTitle from "@/components/InteractiveTitle";

export default async function DashboardPage() {
  const { language } = await getServerTranslator();

  return (
    <main className="fixed inset-0 flex h-screen w-screen flex-col items-center justify-center px-6 text-white overflow-hidden pt-50">
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
      
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <InteractiveTitle title="Forecast" />
        <p className="max-w-2xl text-lg leading-relaxed text-white/85">
          {language === "th"
            ? "ที่ที่คลื่นลูกใหม่ของการพยากรณ์ความต้องการกำลังก่อตัวขึ้น"
            : "Where the next wave of storytelling-grade forecasting comes to life."}
        </p>
        <Link
          href="/forecast"
          className="inline-flex min-w-[190px] items-center justify-center rounded-full bg-transparent px-10 py-4 text-xs font-semibold uppercase tracking-[0.32em] text-white/90 shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition duration-300 hover:-translate-y-0.5 hover:text-white supports-[backdrop-filter]:bg-white/12 backdrop-blur supports-[backdrop-filter]:backdrop-blur-xl"
        >
          {language === "th" ? "เริ่มสร้าง Forecast" : "Create Forecast"}
        </Link>
        <Link
          href="/settings"
          className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-white/75 transition hover:text-white"
        >
          {language === "th" ? "สำรวจการตั้งค่า" : "Explore settings"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/history"
          className="mt-2 text-[11px] uppercase tracking-[0.4em] text-white/65 transition hover:text-white"
        >
          {language === "th" ? "ดูประวัติทั้งหมด" : "View history"}
        </Link>
      </div>
    </main>
  );
}
