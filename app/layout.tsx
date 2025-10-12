import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Providers from "./providers";
import { getServerLanguage } from "@/lib/i18n/server";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const montserratDisplay = Montserrat({
  variable: "--font-montserrat-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fashion Demand Forecast",
  description: "Minimal demand forecasting workspace powered by Supabase-authenticated LightGBM models.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();

  return (
    <html lang={language}>
      <body
        className={`${montserrat.variable} ${montserratDisplay.variable} antialiased bg-black text-white`}
        suppressHydrationWarning
      >
        <Providers initialLanguage={language}>
          <div className="relative min-h-screen overflow-hidden">
            <video
              className="fixed inset-0 z-[-2] h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              poster="https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1920&q=80"
            >
              <source src="/media/hero.mp4" type="video/mp4" />
            </video>
            <div
              className="fixed inset-0 z-[-1] bg-gradient-to-b from-black via-black/70 to-black"
              aria-hidden
            />
            <div
              className="fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08)_0%,_transparent_55%,_rgba(0,0,0,0.92)_100%)]"
              aria-hidden
            />

            <main className="relative z-10 flex min-h-screen flex-col">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
