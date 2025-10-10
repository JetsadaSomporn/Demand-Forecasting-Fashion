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
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-6">
      <div className="w-full max-w-[340px] space-y-6">
        {/* Clean heading - just "Sign In" */}
        <div>
          <h1 className="text-[28px] font-light tracking-tight text-gray-900">
            Sign In
          </h1>
        </div>

        {/* Form with minimal styling */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-light text-gray-600" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder=""
              className="mt-0.5 w-full rounded-md bg-gray-200/70 px-3 py-2 text-[15px] font-light text-gray-900 outline-none transition placeholder:text-gray-400 hover:bg-gray-200 focus:bg-gray-200"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded bg-blue-600 px-4 py-2.5 text-[13px] font-normal text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Next"}
          </button>
        </form>

        {/* Minimal alert messages */}
        {message ? (
          <div className="text-[13px] font-light text-blue-600">
            {message.key ? t(message.key) : message.raw}
          </div>
        ) : null}
        {error ? (
          <div className="text-[13px] font-light text-red-600">
            {error.key ? t(error.key) : error.raw}
          </div>
        ) : null}
      </div>
    </div>
  );
}
