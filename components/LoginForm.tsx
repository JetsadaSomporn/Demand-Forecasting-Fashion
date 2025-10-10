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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 bg-white">
      <div className="space-y-3 text-center">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-bold uppercase tracking-[0.2em] text-gray-900">
          {t("login.title")}
        </h1>
        <p className="text-sm leading-relaxed text-gray-600">{t("login.description")}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-[28px] border-2 border-gray-200 bg-white p-8 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-900">
            {t("login.emailLabel")}
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("login.emailPlaceholder")}
            className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full border-2 border-blue-600 bg-blue-600 px-8 py-3 text-sm font-bold uppercase tracking-[0.3em] shadow-[0_8px_16px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:border-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          style={{ color: '#FFFFFF' }}
        >
          {isSubmitting ? t("login.sendingLink") : t("login.sendLink")}
        </button>
      </form>
      {message ? (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
          {message
            ? message.key
              ? t(message.key)
              : message.raw
            : null}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700">
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
