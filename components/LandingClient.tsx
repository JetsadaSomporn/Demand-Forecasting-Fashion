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
  
  // Refs for staggered animations
  const impactSectionRef = useRef<HTMLDivElement>(null);
  const workflowSectionRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // 1. Subtle Video Darkening
      gsap.to(videoOverlayRef.current, {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
        opacity: 0.9, 
        ease: "none",
      });

      // 2. Minimal Hero Fade (Parallax)
      // Moves slightly slower than scroll and fades out
      gsap.to(heroRef.current, {
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom 40%", // Fades out earlier
          scrub: true,
        },
        y: 50, // Reduced movement
        opacity: 0,
        ease: "power1.inOut",
      });

      // 3. Staggered Reveals (Generic Utility)
      const setupStagger = (trigger: HTMLElement | null, targets: string) => {
        if (!trigger) return;
        
        // Select elements inside the trigger
        const elements = trigger.querySelectorAll(targets);
        
        gsap.fromTo(
          elements,
          { y: 30, opacity: 0 }, // Very subtle shift
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.15, // Nice delay between items
            ease: "power2.out",
            scrollTrigger: {
              trigger: trigger,
              start: "top 75%", // Starts when section is well into view
              toggleActions: "play none none reverse",
            },
          }
        );
      };

      setupStagger(impactSectionRef.current, ".anim-item");
      setupStagger(workflowSectionRef.current, ".anim-item");
      setupStagger(ctaSectionRef.current, ".anim-item");
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="relative min-h-[300vh] flex flex-col bg-black text-white selection:bg-white/20 font-sans">
      {/* Fixed Background Video */}
      <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
        {/* Dynamic Overlay */}
        <div 
          ref={videoOverlayRef}
          className="absolute inset-0 bg-black opacity-0" 
          aria-hidden 
        />
        {/* Static Grain/Texture (optional, keeps it minimal) */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03]" aria-hidden />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 z-50 flex w-full items-center justify-between gap-4 px-6 py-6 mix-blend-difference text-white/90 transition-all duration-300">
        <Link href="/" className="font-display text-sm tracking-[0.3em] uppercase hover:opacity-70 transition-opacity">
          {t("common.brand")}
        </Link>
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Navigation items={navItems} />
        </div>
        <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.2em]">
          <span className="hidden sm:inline text-white/60">{accountLabel}</span>
          <Link
            href={isAuthenticated ? "/logout" : "/login"}
            prefetch={false}
            className="hover:text-white text-white/60 transition-colors"
          >
            {t(isAuthenticated ? "common.signOut" : "common.signIn")}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center w-full">
        
        {/* HERO SECTION */}
        <section 
          ref={heroRef}
          className="flex min-h-screen w-full flex-col items-center justify-center px-6 text-center pt-20"
        >
          <InteractiveTitle title="Forecast" />
          <p className="mx-auto mt-10 max-w-xl text-base md:text-lg leading-relaxed text-white/70 font-light tracking-wide">
            {language === "th"
              ? "ที่ที่คลื่นลูกใหม่ของการพยากรณ์ความต้องการกำลังก่อตัวขึ้น"
              : "Where the next wave of storytelling-grade forecasting comes to life."}
          </p>
          
          <div className="mt-16 flex flex-col items-center gap-8 sm:flex-row">
            <Link
              href="/forecast"
              className="group relative inline-flex items-center justify-center px-8 py-3 text-[10px] font-medium uppercase tracking-[0.3em] text-white border border-white/20 rounded-full hover:bg-white hover:text-black hover:border-transparent transition-all duration-300"
            >
              <span>{language === "th" ? "เริ่มสร้าง Forecast" : "Create Forecast"}</span>
            </Link>
            <Link
              href="/settings"
              className="text-[10px] uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors flex items-center gap-2"
            >
              {language === "th" ? "สำรวจการตั้งค่า" : "Explore settings"}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* SECTION 1: THE IMPACT (Minimal Grid) */}
        <section 
          ref={impactSectionRef}
          className="min-h-screen w-full max-w-7xl px-6 py-32 flex flex-col items-center justify-center"
        >
          <div className="anim-item mb-24 text-center">
            <span className="block text-[9px] font-bold uppercase tracking-[0.4em] text-white/40 mb-4">
              {language === "th" ? "ผลลัพธ์" : "The Impact"}
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light tracking-wide text-white/90">
              {language === "th" ? "แม่นยำกว่า ยั่งยืนกว่า" : "Smarter. Greener. Faster."}
            </h2>
          </div>
          
          <div className="grid w-full gap-px bg-white/10 border border-white/10 md:grid-cols-3 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Card 1 */}
            <div className="anim-item group relative bg-black/40 p-12 backdrop-blur-sm transition-colors hover:bg-white/5">
              <div className="mb-8 text-white/80 group-hover:text-blue-400 transition-colors">
                <Brain className="h-8 w-8 stroke-1" />
              </div>
              <h3 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-white">AI-Driven</h3>
              <p className="text-sm leading-7 text-white/50 font-light">
                {language === "th" 
                 ? "ใช้โมเดล Machine Learning ขั้นสูงในการวิเคราะห์แนวโน้มเพื่อความแม่นยำสูงสุด"
                 : "Powered by advanced Machine Learning models to analyze trends with pinpoint accuracy."}
              </p>
            </div>

            {/* Card 2 */}
            <div className="anim-item group relative bg-black/40 p-12 backdrop-blur-sm transition-colors hover:bg-white/5">
              <div className="mb-8 text-white/80 group-hover:text-green-400 transition-colors">
                <Leaf className="h-8 w-8 stroke-1" />
              </div>
              <h3 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-white">Eco-Friendly</h3>
              <p className="text-sm leading-7 text-white/50 font-light">
                {language === "th"
                 ? "ลดสต็อกส่วนเกิน ช่วยลดขยะและผลกระทบต่อสิ่งแวดล้อม"
                 : "Reduce overstock and waste. Optimize your inventory for a sustainable future."}
              </p>
            </div>

            {/* Card 3 */}
            <div className="anim-item group relative bg-black/40 p-12 backdrop-blur-sm transition-colors hover:bg-white/5">
              <div className="mb-8 text-white/80 group-hover:text-purple-400 transition-colors">
                <TrendingUp className="h-8 w-8 stroke-1" />
              </div>
              <h3 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-white">Max Profit</h3>
              <p className="text-sm leading-7 text-white/50 font-light">
                {language === "th"
                 ? "เพิ่มกำไรสูงสุดด้วยการวางแผนที่แม่นยำและลดต้นทุนที่ไม่จำเป็น"
                 : "Maximize margins by predicting exactly what you need, when you need it."}
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: WORKFLOW (Minimal List) */}
        <section 
          ref={workflowSectionRef}
          className="min-h-screen w-full max-w-4xl px-6 py-32 flex flex-col justify-center"
        >
          <div className="anim-item mb-20">
            <span className="block text-[9px] font-bold uppercase tracking-[0.4em] text-white/40 mb-4">
              {language === "th" ? "ขั้นตอน" : "Workflow"}
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light tracking-wide text-white/90">
              {language === "th" ? "เรียบง่าย ทรงพลัง" : "Simple yet Powerful."}
            </h2>
          </div>

          <div className="flex flex-col gap-16">
            {/* Step 1 */}
            <div className="anim-item flex flex-col md:flex-row gap-8 md:gap-16 border-t border-white/10 pt-8 transition-opacity hover:opacity-100 opacity-80">
              <span className="text-xs font-mono text-white/40">01</span>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-light text-white mb-4">Upload Data</h3>
                <p className="text-sm leading-relaxed text-white/50 max-w-md">
                  {language === "th"
                   ? "อัปโหลดไฟล์ CSV หรือ Excel ที่มีข้อมูลยอดขายในอดีตของคุณ"
                   : "Drag and drop your historical sales data. We support CSV and Excel formats."}
                </p>
              </div>
              <div className="hidden md:flex items-center justify-center h-12 w-12 rounded-full bg-white/5 text-white/30">
                <Upload className="h-5 w-5 stroke-1" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="anim-item flex flex-col md:flex-row gap-8 md:gap-16 border-t border-white/10 pt-8 transition-opacity hover:opacity-100 opacity-80">
              <span className="text-xs font-mono text-white/40">02</span>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-light text-white mb-4">AI Processing</h3>
                <p className="text-sm leading-relaxed text-white/50 max-w-md">
                  {language === "th"
                   ? "ระบบจะวิเคราะห์รูปแบบตามฤดูกาลและเทรนด์โดยอัตโนมัติ"
                   : "Our LightGBM models analyze seasonality, trends, and anomalies in seconds."}
                </p>
              </div>
              <div className="hidden md:flex items-center justify-center h-12 w-12 rounded-full bg-white/5 text-white/30">
                <Cpu className="h-5 w-5 stroke-1" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="anim-item flex flex-col md:flex-row gap-8 md:gap-16 border-t border-white/10 pt-8 transition-opacity hover:opacity-100 opacity-80">
              <span className="text-xs font-mono text-white/40">03</span>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-light text-white mb-4">Actionable Forecasts</h3>
                <p className="text-sm leading-relaxed text-white/50 max-w-md">
                  {language === "th"
                   ? "รับผลลัพธ์การพยากรณ์ที่แม่นยำเพื่อนำไปวางแผนการผลิตทันที"
                   : "Receive precise demand predictions and export them for your production planning."}
                </p>
              </div>
              <div className="hidden md:flex items-center justify-center h-12 w-12 rounded-full bg-white/5 text-white/30">
                <LineChart className="h-5 w-5 stroke-1" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION (Minimal) */}
        <section 
          ref={ctaSectionRef}
          className="min-h-[50vh] w-full flex flex-col items-center justify-center px-6 text-center pb-20"
        >
          <h2 className="anim-item mb-12 max-w-2xl font-display text-4xl md:text-6xl tracking-wider text-white">
            {language === "th" ? "พร้อมเริ่มกันเลยไหม?" : "Ready to Predict?"}
          </h2>
          <Link
            href="/forecast"
            className="anim-item group relative inline-flex items-center justify-center gap-3 rounded-full bg-white px-12 py-4 text-[11px] font-bold uppercase tracking-[0.25em] text-black transition-transform hover:scale-105"
          >
            <span>{language === "th" ? "เริ่มเลย ฟรี" : "Start Now"}</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        {/* Footer (Minimal) */}
        <footer className="w-full border-t border-white/5 bg-black px-6 py-12 flex flex-col md:flex-row items-center justify-between text-white/30 text-[10px] uppercase tracking-[0.15em] gap-6">
           <p>© 2025 Fashion Demand Forecast.</p>
           <div className="flex gap-6">
              <Globe className="h-4 w-4 hover:text-white/60 transition-colors cursor-pointer" />
              <MousePointerClick className="h-4 w-4 hover:text-white/60 transition-colors cursor-pointer" />
           </div>
        </footer>
      </main>
    </div>
  );
}
