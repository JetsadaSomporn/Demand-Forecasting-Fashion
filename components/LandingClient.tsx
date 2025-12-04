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
  const heroRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRevealRef = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // 1. Hero Fade Out & Video Blur
      const tlHero = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      tlHero
        .to(heroRef.current, { opacity: 0, scale: 0.95, ease: "power1.out" })
        .to(videoRef.current, { filter: "blur(20px)", opacity: 0.2 }, 0);

      // 2. Cinematic Text Reveal (Pinned Section)
      // This section pins the screen and swaps text based on scroll position
      const texts = gsap.utils.toArray(".reveal-text");
      
      const tlText = gsap.timeline({
        scrollTrigger: {
          trigger: textRevealRef.current,
          start: "top top",
          end: "+=300%", // Pin for 3 screen heights
          pin: true,
          scrub: 0.5,
        },
      });

      texts.forEach((text: any, i) => {
        // Fade in
        tlText.fromTo(
          text,
          { opacity: 0, y: 50, filter: "blur(10px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: "power2.out" }
        );
        // Fade out (unless it's the last one)
        if (i < texts.length - 1) {
          tlText.to(text, { opacity: 0, y: -50, filter: "blur(10px)", duration: 1, ease: "power2.in" }, "+=0.5");
        }
      });

      // 3. Bento Grid Parallax
      // Cards move at slightly different speeds
      gsap.from(".bento-card", {
        scrollTrigger: {
          trigger: bentoRef.current,
          start: "top 80%",
          end: "bottom top",
          scrub: 1,
        },
        y: (i) => i * 50 + 100, // Staggered Y start
        opacity: 0,
        duration: 1,
      });

    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="relative bg-black text-white selection:bg-white/20 font-sans overflow-x-hidden">
      
      {/* Fixed Background Video */}
      <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-60 transition-all duration-500"
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Header (Transparent & Minimal) */}
      <header className="fixed top-0 left-0 z-50 flex w-full items-center justify-between px-6 py-8 transition-all duration-300">
        <Link href="/" className="font-display text-sm tracking-[0.2em] uppercase text-white hover:opacity-70 transition-opacity">
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

      {/* 1. HERO SECTION */}
      <section 
        ref={heroRef}
        className="relative z-10 flex h-screen w-full flex-col items-center justify-center px-6 text-center"
      >
        <div className="flex flex-col items-center gap-6">
          <InteractiveTitle title="Forecast" />
          <p className="max-w-xl text-lg md:text-2xl font-light text-white/80 leading-relaxed tracking-wide">
            {language === "th"
              ? "อนาคตของการพยากรณ์ อยู่ในมือคุณ"
              : "The future of demand forecasting. Redefined."}
          </p>
          <div className="mt-8 flex items-center gap-4">
             <Link
              href="/forecast"
              className="group relative inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-black transition-transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              {language === "th" ? "เริ่มต้น" : "Get Started"}
            </Link>
          </div>
        </div>
        
        <div className="absolute bottom-10 text-white/30 text-[10px] uppercase tracking-[0.3em] animate-pulse">
          Scroll to explore
        </div>
      </section>

      {/* 2. PINNED TEXT REVEAL (Cinematic Storytelling) */}
      <section 
        ref={textRevealRef}
        className="relative z-20 h-screen w-full flex items-center justify-center bg-black"
      >
        <div className="relative w-full max-w-4xl text-center px-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="reveal-text text-5xl md:text-8xl font-display font-bold text-white tracking-tight opacity-0">
              {language === "th" ? "แม่นยำ." : "Precision."}
            </h2>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="reveal-text text-5xl md:text-8xl font-display font-bold text-blue-500 tracking-tight opacity-0">
              {language === "th" ? "ชาญฉลาด." : "Intelligence."}
            </h2>
          </div>
           <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="reveal-text text-5xl md:text-8xl font-display font-bold text-purple-500 tracking-tight opacity-0">
              {language === "th" ? "กำไร." : "Profit."}
            </h2>
          </div>
        </div>
      </section>

      {/* 3. BENTO GRID (Features) */}
      <section 
        ref={bentoRef}
        className="relative z-20 w-full bg-black px-6 py-32"
      >
        <div className="mx-auto max-w-6xl">
           <div className="mb-24 text-center">
            <span className="text-blue-500 font-semibold tracking-widest uppercase text-xs">Features</span>
            <h2 className="mt-4 text-4xl md:text-6xl font-display font-bold text-white">
              {language === "th" ? "ทรงพลังทุกมิติ" : "Power in every pixel."}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[400px]">
            {/* Card 1: Large Span */}
            <div className="bento-card md:col-span-2 relative overflow-hidden rounded-3xl bg-[#0c0c0c] border border-white/10 p-10 transition-colors hover:border-white/20 group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/10 text-white mb-6">
                    <Brain className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2">AI-Powered Core</h3>
                  <p className="text-white/50 max-w-md">
                    {language === "th" 
                    ? "ระบบวิเคราะห์ข้อมูลระดับสูงที่เรียนรู้จากอดีตเพื่อทำนายอนาคตของคุณ"
                    : "Our proprietary machine learning models analyze thousands of data points to predict demand with unprecedented accuracy."}
                  </p>
                </div>
                <div className="w-full h-32 bg-gradient-to-t from-blue-500/20 to-transparent rounded-xl mt-8 border border-white/5 relative overflow-hidden">
                   {/* Fake Graph Line */}
                   <div className="absolute bottom-0 left-0 right-0 h-full w-full">
                      <svg viewBox="0 0 100 50" className="w-full h-full text-blue-500 fill-current opacity-20">
                        <path d="M0,50 Q25,20 50,30 T100,10 V50 H0 Z" />
                      </svg>
                   </div>
                </div>
              </div>
            </div>

            {/* Card 2: Tall */}
            <div className="bento-card md:col-span-1 relative overflow-hidden rounded-3xl bg-[#0c0c0c] border border-white/10 p-10 transition-colors hover:border-white/20 group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
              <div className="relative z-10 flex flex-col h-full">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/10 text-white mb-6">
                  <Leaf className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Sustainable</h3>
                <p className="text-white/50 mb-8">
                   {language === "th" ? "ลดขยะ ลดต้นทุน" : "Cut waste. Save the planet."}
                </p>
                <div className="flex-1 flex items-center justify-center">
                   <div className="relative h-32 w-32 rounded-full border-4 border-green-500/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-green-500">-40%</span>
                      <span className="absolute -bottom-6 text-xs text-white/40 uppercase tracking-widest">Waste</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Card 3: Wide */}
            <div className="bento-card md:col-span-3 relative overflow-hidden rounded-3xl bg-[#0c0c0c] border border-white/10 p-10 transition-colors hover:border-white/20 group flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/10 text-white mb-6">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-3xl font-semibold text-white mb-4">Maximize Revenue</h3>
                <p className="text-white/50 text-lg">
                  {language === "th" 
                   ? "เปลี่ยนข้อมูลให้เป็นกำไร พยากรณ์แม่นยำช่วยให้คุณสต็อกสินค้าได้พอดีกับความต้องการ"
                   : "Stop guessing. Start knowing. Optimize your inventory levels to ensure you never miss a sale or hold too much stock."}
                </p>
                <div className="mt-8">
                   <Link href="/forecast" className="text-sm font-bold uppercase tracking-widest text-white hover:text-blue-400 transition-colors inline-flex items-center gap-2">
                      {language === "th" ? "เริ่มใช้งาน" : "Start Forecasting"} <ArrowRight className="w-4 h-4"/>
                   </Link>
                </div>
              </div>
              <div className="flex-1 w-full max-w-md aspect-video bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                 <span className="text-white/20 font-mono text-xs">Interactive Chart Preview</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FINAL CTA & FOOTER WRAPPER */}
      <div className="relative z-20 w-full bg-black">
        <section className="flex flex-col items-center text-center px-6 pt-40 pb-24">
           <h2 className="text-5xl md:text-8xl font-display font-bold text-white mb-8 tracking-tight">
              {language === "th" ? "อนาคต." : "Future."}
           </h2>
           <p className="text-white/50 text-xl mb-12 max-w-2xl">
              {language === "th" 
               ? "พร้อมที่จะเปลี่ยนวิธีที่คุณทำธุรกิจหรือยัง?"
               : "Ready to change the way you do business?"}
           </p>
           <Link
              href="/forecast"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-10 py-5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-blue-500 hover:scale-105 shadow-[0_0_50px_rgba(37,99,235,0.5)]"
            >
              {language === "th" ? "เริ่มเลย ฟรี" : "Get Started for Free"}
            </Link>
        </section>

        {/* Footer */}
        <footer className="w-full px-6 py-12">
          <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-8">
             <div className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
                © 2025 Fashion Demand Forecast
             </div>
             <div className="flex gap-8 text-[10px] uppercase tracking-widest text-white/40">
                <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-white transition-colors">Terms</Link>
                <Link href="#" className="hover:text-white transition-colors">Contact</Link>
             </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
