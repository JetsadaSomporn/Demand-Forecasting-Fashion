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
          // Disable PKCE to avoid code verifier issues
          data: {},
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("login.title")}</h1>
        <p className="mt-2 text-sm text-foreground-muted">{t("login.description")}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{t("login.emailLabel")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("login.emailPlaceholder")}
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {isSubmitting ? t("login.sendingLink") : t("login.sendLink")}
        </button>
      </form>
      {message ? (
        <div className="rounded-xl border border-accent-muted bg-accent-muted/50 px-4 py-3 text-sm text-foreground">
          {message
            ? message.key
              ? t(message.key)
              : message.raw
            : null}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error
            ? error.key
              ? t(error.key)
              : error.raw
            : null}
        </div>
      ) : null}
    </div>
  );
}
