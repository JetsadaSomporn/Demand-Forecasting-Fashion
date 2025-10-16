import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieOptions,
  type CookieOptionsWithName,
} from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv } from "./supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  assertSupabaseEnv("anon");

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: buildHeaderCookieAdapter({
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          try {
            const setFn = (cookieStore as unknown as Record<string, unknown>).set;
            if (typeof setFn === "function") {
              (setFn as (name: string, value: string, options: CookieOptions) => void)(
                cookie.name,
                cookie.value,
                cookie.options
              );
            }
          } catch (error) {
            console.error(`[SSR Cookie] setAll ${cookie.name} failed:`, error);
          }
        }
      },
    }),
  });
}

export function createSupabaseRouteHandlerClient(
  request: NextRequest,
  response: NextResponse,
  options?: { cookieOptions?: CookieOptionsWithName }
) {
  assertSupabaseEnv("anon");

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookieOptions: options?.cookieOptions,
    cookies: buildHeaderCookieAdapter({
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          response.cookies.set({
            name: cookie.name,
            value: cookie.value,
            ...cookie.options,
          });
        }
      },
    }),
  });
}

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
  options?: { cookieOptions?: CookieOptionsWithName }
) {
  return createSupabaseRouteHandlerClient(request, response, options);
}

type CookieAdapter = {
  getAll: () => Array<{ name: string; value: string }>;
  setAll: (
    cookiesToSet: Array<{
      name: string;
      value: string;
      options: CookieOptions;
    }>
  ) => void;
};

function buildHeaderCookieAdapter(adapter: CookieAdapter) {
  return {
    getAll() {
      return adapter.getAll();
    },
    setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
      adapter.setAll(cookiesToSet);
    },
  };
}
