import type { Metadata } from "next";
import localFont from "next/font/local";
import Providers from "./providers";
import { getServerLanguage } from "@/lib/i18n/server";
import "./globals.css";
import { getSettingsDefaults } from "@/lib/queries";

const productSans = localFont({
  variable: "--font-product-sans",
  src: [
    {
      path: "../public/google-sans/ProductSans-Thin.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-ThinItalic.ttf",
      weight: "100",
      style: "italic",
    },
    {
      path: "../public/google-sans/ProductSans-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-LightItalic.ttf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/google-sans/ProductSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/google-sans/ProductSans-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/google-sans/ProductSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../public/google-sans/ProductSans-Black.ttf",
      weight: "900",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-BlackItalic.ttf",
      weight: "900",
      style: "italic",
    },
  ],
  display: "swap",
});

const productSansDisplay = localFont({
  variable: "--font-product-sans-display",
  src: [
    {
      path: "../public/google-sans/ProductSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/google-sans/ProductSans-Black.ttf",
      weight: "900",
      style: "normal",
    },
  ],
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
  const [language, settings] = await Promise.all([
    getServerLanguage(),
    getSettingsDefaults(),
  ]);
  const initialTheme = settings.theme ?? "dark";

  return (
    <html
      lang={language}
      data-theme={initialTheme}
      className={initialTheme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body
        className={`${productSans.variable} ${productSansDisplay.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers initialLanguage={language} initialTheme={initialTheme}>
          <main className="flex min-h-screen flex-col">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
