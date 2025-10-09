"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n/client";
import type { Language } from "@/lib/i18n";

type ProvidersProps = {
  children: ReactNode;
  initialLanguage: Language;
};

export default function Providers({ children, initialLanguage }: ProvidersProps) {
  return <LanguageProvider initialLanguage={initialLanguage}>{children}</LanguageProvider>;
}

