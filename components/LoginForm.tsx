"use client";

import { useState } from "react";
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("[Login] Sending magic link with redirect:", redirectUrl);
      
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        console.error("[Login] Sign in error:", signInError);
        throw signInError;
      }

      console.log("[Login] Magic link sent successfully");
      setMessage({ key: "login.alerts.checkEmail" });
      setEmail("");
    } catch (err) {
      console.error("[Login] Error sending magic link", err);
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
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }

      setMessage({ key: "login.google.redirect" });
    } catch (err) {
      console.error("[Login] Google sign-in error", err);
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
            <h1 className="text-[32px] font-semibold tracking-tight text-white">
              {t("login.title")}
            </h1>
            <p className="text-[13px] text-white/60">
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
