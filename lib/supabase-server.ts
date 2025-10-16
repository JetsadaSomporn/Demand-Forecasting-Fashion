import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv } from "./supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  assertSupabaseEnv("anon");

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            const cookieOptions = {
              ...cookie.options,
              path: '/',
              maxAge: cookie.options?.maxAge || 60 * 60 * 24 * 7,
              sameSite: 'lax' as const,
              secure: true,
              httpOnly: cookie.options?.httpOnly ?? true,
              domain: undefined,
            };
            
            cookieStore.set({
              name: cookie.name,
              value: cookie.value,
              ...cookieOptions,
            });
          }
        } catch (error) {
          console.warn("[SupabaseServer] Failed to set cookies from server component", error);
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

export function createSupabaseRouteHandlerClient(
  request: NextRequest,
  response: NextResponse,
) {
  assertSupabaseEnv("anon");

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          const cookieOptions = {
            ...cookie.options,
            path: '/',
            maxAge: cookie.options?.maxAge || 60 * 60 * 24 * 7,
            sameSite: 'lax' as const,
            secure: true,
            httpOnly: cookie.options?.httpOnly ?? true,
            domain: undefined,
          };
          
          response.cookies.set({
            name: cookie.name,
            value: cookie.value,
            ...cookieOptions,
          });
        }
      },
    },
  });
}
