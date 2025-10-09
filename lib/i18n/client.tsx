"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  availableLanguages,
  createTranslator,
  defaultLanguage,
  isLanguage,
  type Language,
} from "./index";

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslateFn;
  languages: Language[];
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const LANGUAGE_COOKIE = "df_lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeCookie(language: Language) {
  const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000);
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${COOKIE_MAX_AGE}; expires=${expires.toUTCString()}`;
}

function readStoredLanguage(): Language | null {
  if (typeof window === "undefined") return null;
  try {
    const storedLocal = window.localStorage.getItem(LANGUAGE_COOKIE);
    if (storedLocal && isLanguage(storedLocal)) return storedLocal;
  } catch (error) {
    console.warn("Failed to read language from localStorage", error);
  }

  const cookieMatch = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANGUAGE_COOKIE}=`));
  if (cookieMatch) {
    const value = cookieMatch.split("=")[1];
    if (isLanguage(value)) return value;
  }
  return null;
}

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) {
  const [language, setLanguageState] = useState<Language>(
    initialLanguage ?? defaultLanguage
  );

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored && stored !== language) {
      setLanguageState(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_COOKIE, language);
    } catch (error) {
      console.warn("Failed to persist language to localStorage", error);
    }
    writeCookie(language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState((current) => (current === next ? current : next));
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const translator = createTranslator(language);
    return {
      language,
      setLanguage,
      t: (key, params) => translator.t(key, params),
      languages: availableLanguages,
    };
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
