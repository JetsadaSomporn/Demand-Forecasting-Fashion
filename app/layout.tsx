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
      <body className={`${montserrat.variable} ${montserratDisplay.variable} antialiased`}>
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
