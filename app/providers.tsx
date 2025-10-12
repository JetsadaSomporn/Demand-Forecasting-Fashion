"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n/client";
import type { Language } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme/client";
import type { ThemeMode } from "@/lib/theme";

type ProvidersProps = {
  children: ReactNode;
  initialLanguage: Language;
  initialTheme: ThemeMode;
};

export default function Providers({
  children,
  initialLanguage,
  initialTheme,
}: ProvidersProps) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <LanguageProvider initialLanguage={initialLanguage}>{children}</LanguageProvider>
    </ThemeProvider>
  );
}
