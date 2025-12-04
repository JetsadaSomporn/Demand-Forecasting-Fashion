"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Cpu, Globe, Leaf, LineChart, MousePointerClick, TrendingUp, Upload } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import InteractiveTitle from "@/components/InteractiveTitle";
import Navigation from "@/components/Navigation";
import { useTranslation } from "@/lib/i18n/client";

gsap.registerPlugin(ScrollTrigger);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoOverlayRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<Array<HTMLDivElement | null>>([]);

  useGSAP(
    () => {
      // 1. Video Darkening Effect
      // As user scrolls down, the black overlay gets more opaque (0 -> 0.9)
      gsap.to(videoOverlayRef.current, {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
        opacity: 0.95,
        ease: "none",
      });

      // 2. Hero Parallax / Fade Out
      gsap.to(heroRef.current, {
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
        y: 100,
        opacity: 0,
      });

      // 3. Sections "Rise Up" & Fade In
      sectionsRef.current.forEach((section) => {
        if (!section) return;
        
        gsap.fromTo(
          section,
          { y: 100, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%", // Start animating when top of section hits 80% of viewport
              end: "top 50%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    },
    { scope: containerRef }
  );

  const addToRefs = (el: HTMLDivElement | null) => {
    if (el && !sectionsRef.current.includes(el)) {
      sectionsRef.current.push(el);
    }
  };

  return (
    <div ref={containerRef} className="relative min-h-[300vh] flex flex-col bg-black text-white selection:bg-white/20">
      {/* Fixed Background Video */}
      <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
        {/* Dynamic Overlay controlled by GSAP */}
        <div 
          ref={videoOverlayRef}
          className="absolute inset-0 bg-black opacity-0" 
          aria-hidden 
        />
        {/* Static Overlays for texture */}
        <div className="theme-linear-overlay absolute inset-0 opacity-60" aria-hidden />
        <div className="theme-radial-overlay absolute inset-0 opacity-60" aria-hidden />
      </div>

      {/* Header (Fixed) */}
      <header className="fixed top-0 left-0 z-50 flex w-full items-center justify-between gap-4 px-6 py-4 mix-blend-difference text-white">
        <Link href="/" className="font-display text-lg tracking-[0.4em] uppercase">
          {t("common.brand")}
        </Link>
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Navigation items={navItems} />
        </div>
        <div className="flex items-center gap-3 text-white/90">
          <span className="whitespace-nowrap text-[13px]">{accountLabel}</span>
          <Link
            href={isAuthenticated ? "/logout" : "/login"}
            prefetch={false}
            className="text-[11px] uppercase tracking-[0.35em] transition hover:text-accent"
          >
            {t(isAuthenticated ? "common.signOut" : "common.signIn")}
          </Link>
        </div>
      </header>

      {/* Main Content Flow */}
      <main className="relative z-10 flex flex-col items-center w-full">
        
        {/* HERO SECTION */}
        <section 
          ref={heroRef}
          className="flex min-h-screen w-full flex-col items-center justify-center px-6 text-center"
        >
          <div className="mt-20 md:mt-0">
            <InteractiveTitle title="Forecast" />
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/85 font-light tracking-wide">
              {language === "th"
                ? "ที่ที่คลื่นลูกใหม่ของการพยากรณ์ความต้องการกำลังก่อตัวขึ้น"
                : "Where the next wave of storytelling-grade forecasting comes to life."}
            </p>
            
            <div className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
              <Link
                href="/forecast"
                className="group relative inline-flex min-w-[220px] items-center justify-center overflow-hidden rounded-full bg-white/10 px-10 py-4 text-xs font-semibold uppercase tracking-[0.32em] text-white backdrop-blur-md transition-all duration-500 hover:bg-white hover:text-black hover:scale-105"
              >
                <span className="relative z-10">{language === "th" ? "เริ่มสร้าง Forecast" : "Create Forecast"}</span>
              </Link>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-white/70 transition-colors hover:text-white"
              >
                {language === "th" ? "สำรวจการตั้งค่า" : "Explore settings"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          
          {/* Scroll Indicator */}
          <div className="absolute bottom-12 animate-bounce text-white/50">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          </div>
        </section>

        {/* SECTION 1: THE PROBLEM / IMPACT */}
        <section 
          ref={addToRefs}
          className="min-h-[80vh] w-full max-w-6xl px-6 py-24 flex flex-col items-center justify-center"
        >
          <span className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-blue-400">
            {language === "th" ? "ผลลัพธ์" : "The Impact"}
          </span>
          <h2 className="mb-16 text-center font-display text-4xl font-medium tracking-wider text-white md:text-6xl">
            {language === "th" ? "แม่นยำกว่า ยั่งยืนกว่า" : "Smarter. Greener. Faster."}
          </h2>
          
          <div className="grid w-full gap-8 md:grid-cols-3">
            <div className="group rounded-2xl border border-white/10 bg-white/5 p-8 transition-all hover:border-white/20 hover:bg-white/10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-medium tracking-wide text-white">AI-Driven</h3>
              <p className="text-sm leading-relaxed text-white/60">
                {language === "th" 
                 ? "ใช้โมเดล Machine Learning ขั้นสูงในการวิเคราะห์แนวโน้มเพื่อความแม่นยำสูงสุด"
                 : "Powered by advanced Machine Learning models to analyze trends with pinpoint accuracy."}
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/5 p-8 transition-all hover:border-white/20 hover:bg-white/10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                <Leaf className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-medium tracking-wide text-white">Eco-Friendly</h3>
              <p className="text-sm leading-relaxed text-white/60">
                {language === "th"
                 ? "ลดสต็อกส่วนเกิน ช่วยลดขยะและผลกระทบต่อสิ่งแวดล้อม"
                 : "Reduce overstock and waste. Optimize your inventory for a sustainable future."}
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/5 p-8 transition-all hover:border-white/20 hover:bg-white/10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-medium tracking-wide text-white">Max Profit</h3>
              <p className="text-sm leading-relaxed text-white/60">
                {language === "th"
                 ? "เพิ่มกำไรสูงสุดด้วยการวางแผนที่แม่นยำและลดต้นทุนที่ไม่จำเป็น"
                 : "Maximize margins by predicting exactly what you need, when you need it."}
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: HOW IT WORKS (Steps) */}
        <section 
          ref={addToRefs}
          className="min-h-[80vh] w-full max-w-5xl px-6 py-24"
        >
          <div className="mb-16 flex flex-col items-center text-center">
            <span className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-purple-400">
              {language === "th" ? "ขั้นตอน" : "Workflow"}
            </span>
            <h2 className="font-display text-3xl font-medium tracking-wider text-white md:text-5xl">
              {language === "th" ? "3 ขั้นตอนง่ายๆ" : "How it Works"}
            </h2>
          </div>

          <div className="relative border-l border-white/10 pl-8 md:pl-12">
            {/* Step 1 */}
            <div className="relative mb-16">
              <span className="absolute -left-[41px] md:-left-[57px] flex h-5 w-5 md:h-8 md:w-8 items-center justify-center rounded-full border border-white/20 bg-black text-[10px] md:text-xs text-white/50">1</span>
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <Upload className="h-8 w-8 text-white/80" />
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-medium text-white">Upload Historical Data</h3>
                  <p className="text-sm text-white/60 max-w-md">
                    {language === "th"
                     ? "อัปโหลดไฟล์ CSV หรือ Excel ที่มีข้อมูลยอดขายในอดีตของคุณ"
                     : "Simply upload your CSV or Excel files containing past sales data."}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative mb-16">
              <span className="absolute -left-[41px] md:-left-[57px] flex h-5 w-5 md:h-8 md:w-8 items-center justify-center rounded-full border border-white/20 bg-black text-[10px] md:text-xs text-white/50">2</span>
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <Cpu className="h-8 w-8 text-white/80" />
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-medium text-white">AI Processing</h3>
                  <p className="text-sm text-white/60 max-w-md">
                    {language === "th"
                     ? "ระบบจะวิเคราะห์รูปแบบตามฤดูกาลและเทรนด์โดยอัตโนมัติ"
                     : "Our engine analyzes seasonality, trends, and anomalies automatically."}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <span className="absolute -left-[41px] md:-left-[57px] flex h-5 w-5 md:h-8 md:w-8 items-center justify-center rounded-full border border-white/20 bg-black text-[10px] md:text-xs text-white/50">3</span>
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <LineChart className="h-8 w-8 text-white/80" />
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-medium text-white">Actionable Forecasts</h3>
                  <p className="text-sm text-white/60 max-w-md">
                    {language === "th"
                     ? "รับผลลัพธ์การพยากรณ์ที่แม่นยำเพื่อนำไปวางแผนการผลิตทันที"
                     : "Get precise demand forecasts and actionable insights instantly."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section 
          ref={addToRefs}
          className="flex min-h-[60vh] w-full flex-col items-center justify-center px-6 text-center"
        >
          <h2 className="mb-8 max-w-3xl font-display text-4xl tracking-wider text-white md:text-7xl">
            {language === "th" ? "พร้อมเริ่มกันเลยไหม?" : "Ready to Predict?"}
          </h2>
          <Link
            href="/forecast"
            className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-white px-12 py-5 text-sm font-bold uppercase tracking-[0.25em] text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
          >
            <span className="relative z-10">{language === "th" ? "เริ่มเลย ฟรี" : "Start Now - Free"}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        {/* Footer */}
        <footer className="w-full border-t border-white/10 bg-black px-6 py-12 text-center md:py-16">
          <div className="mb-8 flex justify-center gap-6 text-white/40">
            <Globe className="h-5 w-5 hover:text-white transition" />
            <MousePointerClick className="h-5 w-5 hover:text-white transition" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            © 2025 Fashion Demand Forecast. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
