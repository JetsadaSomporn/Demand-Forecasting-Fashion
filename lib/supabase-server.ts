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
        const allCookies = cookieStore.getAll();
        console.log('[Supabase Server] 📥 getAll() called:', {
          total: allCookies.length,
          supabase: allCookies.filter(c => c.name.startsWith('sb-')).length,
        });
        return allCookies;
      },
      setAll(cookiesToSet) {
        console.log('[Supabase Server] 🍪 setAll() called:', {
          count: cookiesToSet.length,
          names: cookiesToSet.map(c => c.name),
        });
        
        try {
          for (const cookie of cookiesToSet) {
            const cookieOptions = {
              ...cookie.options,
              sameSite: 'lax' as const,
              secure: process.env.NODE_ENV === 'production',
            };
            
            cookieStore.set({
              name: cookie.name,
              value: cookie.value,
              ...cookieOptions,
            });
          }
          console.log('[Supabase Server] ✅ Cookies set successfully');
        } catch (error) {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
          console.warn('[Supabase Server] ⚠️ Cookie set failed:', error);
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
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
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
