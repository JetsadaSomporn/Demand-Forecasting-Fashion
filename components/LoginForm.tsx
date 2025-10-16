"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/client";

type FlashMessage = {
  key?: string;
  raw?: string;
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const initialMessageParam = searchParams.get("message");
  const initialErrorParam = searchParams.get("error");
  const initialMessage: FlashMessage | null = initialMessageParam
    ? { key: `login.alerts.${initialMessageParam}` }
    : null;
  const initialError: FlashMessage | null = initialErrorParam
    ? { key: `login.errors.${initialErrorParam}` }
    : null;
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [message, setMessage] = useState<FlashMessage | null>(initialMessage);
  const [error, setError] = useState<FlashMessage | null>(initialError);
  const [activeLegal, setActiveLegal] = useState<"terms" | "privacy" | null>(null);

  const termsSections = useMemo(
    () => [
      {
        heading: t("login.legal.terms.sections.usageTitle"),
        body: t("login.legal.terms.sections.usageBody"),
      },
      {
        heading: t("login.legal.terms.sections.dataTitle"),
        body: t("login.legal.terms.sections.dataBody"),
      },
      {
        heading: t("login.legal.terms.sections.reliabilityTitle"),
        body: t("login.legal.terms.sections.reliabilityBody"),
      },
    ],
    [t]
  );

  const privacySections = useMemo(
    () => [
      {
        heading: t("login.legal.privacy.sections.accountTitle"),
        body: t("login.legal.privacy.sections.accountBody"),
      },
      {
        heading: t("login.legal.privacy.sections.storageTitle"),
        body: t("login.legal.privacy.sections.storageBody"),
      },
      {
        heading: t("login.legal.privacy.sections.analyticsTitle"),
        body: t("login.legal.privacy.sections.analyticsBody"),
      },
    ],
    [t]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        throw signInError;
      }

      setMessage({ key: "login.alerts.checkEmail" });
      setEmail("");
    } catch (err) {
      if (err instanceof Error) {
        setError({ raw: err.message });
      } else {
        setError({ key: "login.errors.generic" });
      }
    } finally {
      setIsSubmitting(false);
      router.refresh();
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError({ raw: error.message });
      }
    } catch (err) {
      if (err instanceof Error) {
        setError({ raw: err.message });
      } else {
        setError({ key: "login.errors.generic" });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="fixed inset-x-0 top-0 z-40 bg-transparent px-6 py-5">
        <div className="mx-auto max-w-7xl">
          <div className="font-display text-lg tracking-[0.4em] uppercase text-foreground">
            {t("common.brand")}
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-left">
            <h1 className="text-[28px] font-semibold tracking-tight text-white sm:text-[32px]">
              {t("login.title")}
            </h1>
            <p className="text-sm leading-relaxed text-white/60">
              {t("login.description")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder=""
              className="w-full rounded bg-white/8 px-3 py-2.5 text-[15px] text-white outline-none transition focus:bg-white/12"
            />

            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full rounded bg-blue-600 px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t("login.sendingLink") : "Next"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-white/50">
            <span className="h-px flex-1 bg-white/12" aria-hidden />
            <span>- or -</span>
            <span className="h-px flex-1 bg-white/12" aria-hidden />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="btn-google"
          >
            <GoogleIcon />
            <span>{t("login.google.continue")}</span>
          </button>

          {message ? (
            <div className="flex items-start gap-2 text-left text-[14px] text-green-400">
              <span aria-hidden>✓</span>
              <span>{message.key ? t(message.key) : message.raw}</span>
            </div>
          ) : null}

          {error ? (
            <div className="text-left text-[14px] text-red-400">
              {error.key ? t(error.key) : error.raw}
            </div>
          ) : null}

          <p className="pt-2 text-center text-xs text-white/60 sm:pt-4">
            {t("login.legal.notice")}{" "}
            <button
              type="button"
              className="font-medium text-white underline decoration-white/40 underline-offset-2 transition hover:text-white/90 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              onClick={() => setActiveLegal("terms")}
            >
              {t("login.legal.termsLink")}
            </button>{" "}
            {t("login.legal.and")}{" "}
            <button
              type="button"
              className="font-medium text-white underline decoration-white/40 underline-offset-2 transition hover:text-white/90 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              onClick={() => setActiveLegal("privacy")}
            >
              {t("login.legal.privacyLink")}
            </button>
          </p>
        </div>
      </div>

      {activeLegal ? (
        <LegalModal
          title={
            activeLegal === "terms"
              ? t("login.legal.terms.title")
              : t("login.legal.privacy.title")
          }
          intro={
            activeLegal === "terms"
              ? t("login.legal.terms.intro")
              : t("login.legal.privacy.intro")
          }
          sections={activeLegal === "terms" ? termsSections : privacySections}
          closeLabel={
            activeLegal === "terms"
              ? t("login.legal.terms.close")
              : t("login.legal.privacy.close")
          }
          onClose={() => setActiveLegal(null)}
        />
      ) : null}
    </div>
  );
}

type LegalModalProps = {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
  closeLabel: string;
  onClose: () => void;
};

function LegalModal({ title, intro, sections, closeLabel, onClose }: LegalModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 backdrop-blur-md transition-colors sm:px-6 dark:bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="legal-modal-surface max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 text-left transition-colors sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="legal-modal-heading text-lg font-semibold tracking-wide">
              {title}
            </h2>
            <p className="legal-modal-subtext mt-2 text-sm leading-relaxed">{intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="legal-modal-button rounded-full px-2 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="legal-modal-subtext space-y-5 text-sm">
          {sections.map((section) => (
            <section key={section.heading}>
              <h3 className="legal-modal-heading text-[13px] font-semibold uppercase tracking-[0.28em]">
                {section.heading}
              </h3>
              <p className="mt-2 leading-relaxed">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="legal-modal-button rounded-md px-4 py-2 text-sm"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        d="M21.35 11.1h-9.17v2.96h5.49c-.24 1.26-.99 2.33-2.11 3.05v2.53h3.41c2-1.84 3.15-4.55 3.15-7.54 0-.72-.07-1.42-.2-2z"
        fill="#4285F4"
      />
      <path
        d="M12.18 22c2.7 0 4.96-.89 6.62-2.36l-3.41-2.53c-.94.63-2.15 1-3.21 1-2.47 0-4.57-1.67-5.32-3.92H3.35v2.47C4.99 19.98 8.35 22 12.18 22z"
        fill="#34A853"
      />
      <path
        d="M6.86 14.19c-.21-.63-.33-1.29-.33-1.98s.12-1.35.33-1.98V7.76H3.35A9.85 9.85 0 002.18 12c0 1.58.38 3.07 1.17 4.24l3.51-2.05z"
        fill="#FBBC05"
      />
      <path
        d="M12.18 6.46c1.47 0 2.78.51 3.81 1.5l2.85-2.85C16.91 3.56 14.65 2.64 12.18 2.64 8.35 2.64 4.99 4.66 3.35 7.76l3.51 2.47c.75-2.25 2.85-3.92 5.32-3.92z"
        fill="#EA4335"
      />
      <path d="M2.18 2.64h20v20h-20z" fill="none" />
    </svg>
  );
}
