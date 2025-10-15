import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { assertSupabaseEnv } from "@/lib/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const VERIFY_TYPES = new Set([
  "signup",
  "magiclink",
  "recovery",
  "email_change",
]);

function sanitizeRedirect(path: string | null | undefined) {
  if (!path) return "/";
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.startsWith("/")) {
      return decoded;
    }
  } catch {
    // ignore malformed value
  }
  return "/";
}

export async function GET(request: Request) {
  assertSupabaseEnv("anon");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }

  const requestUrl = new URL(request.url);
  const redirectPath = sanitizeRedirect(requestUrl.searchParams.get("redirect"));
  const redirectUrl = new URL(redirectPath, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({
          name,
          value: "",
          ...options,
          maxAge: 0,
        });
      },
    },
  });

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const code = requestUrl.searchParams.get("code");
  const rawType = requestUrl.searchParams.get("type") ?? "magiclink";
  const type = VERIFY_TYPES.has(rawType) ? rawType : "magiclink";

  console.log("[Auth Callback] Params:", {
    tokenHash: tokenHash ? "present" : "missing",
    code: code ? "present" : "missing",
    type,
    redirectPath,
  });

  try {
    if (tokenHash) {
      console.log("[Auth Callback] Verifying OTP token…");
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink" | "signup" | "recovery" | "email_change",
      });
      if (error) {
        throw error;
      }
    } else if (code) {
      console.log("[Auth Callback] Exchanging PKCE code…");
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
    } else {
      throw new Error("Missing verification token or code");
    }

    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }
    if (!sessionData?.session) {
      throw new Error("Session was not created after authentication");
    }

    console.log("[Auth Callback] Session established for user:", sessionData.session.user.id);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    console.error("[Auth Callback] Error:", message, error);

    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "callbackFailed");
    return NextResponse.redirect(loginUrl);
  }
}
