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
              Sign In
            </h1>
            <p className="text-[13px] text-white/60">
              Enter your email to receive a magic link. No password required.
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
            disabled={isSubmitting}
            className="w-full rounded bg-blue-600 px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Next"}
          </button>
        </form>

          {message ? (
            <div className="text-left text-[14px] text-green-400">
              ✓ Check your inbox for a magic link to sign in.
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
