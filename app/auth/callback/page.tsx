"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const VERIFY_TYPES = new Set(["signup", "magiclink", "recovery", "email_change"]);

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const run = async () => {
      const supabase = getSupabaseBrowserClient();

      console.log("[Callback] Full URL:", typeof window !== "undefined" ? window.location.href : "SSR");

      const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = hashParams.get("code") ?? searchParams.get("code");
      const tokenHash = hashParams.get("token_hash") ?? searchParams.get("token_hash");
      const rawType =
        searchParams.get("type") ??
        hashParams.get("type") ??
        "magiclink";
      const type = VERIFY_TYPES.has(rawType) ? rawType : "magiclink";
      const redirectTo = searchParams.get("redirect") ?? hashParams.get("redirect") ?? "/";

      const missing = !accessToken && !refreshToken && !code && !tokenHash;

      console.log("[Callback] URL params:", {
        code,
        tokenHash,
        type,
        accessToken: accessToken ? "present" : "missing",
        refreshToken: refreshToken ? "present" : "missing",
        hash,
        searchParams: searchParams.toString(),
      });

      try {
        // Priority: token_hash (magic link) > access_token (hash) > code (PKCE)
        if (tokenHash) {
          console.log("[Callback] Verifying OTP with token_hash (magic link flow)...");
          const { data, error } = await supabase.auth.verifyOtp({ 
            token_hash: tokenHash, 
            type: type as "magiclink" | "signup" | "recovery" | "email_change"
          });
          if (error) throw error;
          console.log("[Callback] OTP verification successful:", data?.session ? "session created" : "no session");
        } else if (accessToken && refreshToken) {
          console.log("[Callback] Setting session with tokens from URL hash...");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          console.log("[Callback] Session set successful:", data?.session ? "session created" : "no session");
        } else if (code) {
          console.log("[Callback] Exchanging code for session (PKCE flow)...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          console.log("[Callback] Code exchange successful:", data?.session ? "session created" : "no session");
        } else if (missing) {
          throw new Error("Missing verification code, token, or hash");
        }

        // Wait a bit and verify session was created
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[Callback] Final session check:", sessionData?.session ? "session exists" : "NO SESSION");

        if (!sessionData?.session) {
          throw new Error("Session was not created after authentication");
        }

        // Clear hash and redirect using Next.js router for proper cookie sync
        if (typeof window !== "undefined") {
          window.location.hash = "";
          console.log("[Callback] Redirecting to:", redirectTo);
        }
        
        // Use router.push instead of window.location.replace for better cookie sync
        await router.push(redirectTo);
        await router.refresh(); // Force refresh to get new session
      } catch (error) {
        // Check if session exists despite error (e.g., PKCE error but login succeeded)
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log("[Callback] Session exists despite error, proceeding with login");
          if (typeof window !== "undefined") {
            window.location.hash = "";
          }
          await router.push(redirectTo);
          await router.refresh();
          return;
        }

        // Only show error if session really doesn't exist
        const message =
          error instanceof Error ? error.message : "Verification failed";
        console.error("Auth callback error:", message, error);
        if (typeof window !== "undefined") {
          alert("Login failed: " + message);
        }
        await router.replace(`/login?error=${encodeURIComponent(message)}`);
      }
    };

    run();
  }, [router, searchParams]);

  return (
    <div className="grid min-h-screen place-content-center gap-3 text-sm text-foreground-muted">
      <p>Signing you in…</p>
    </div>
  );
}
