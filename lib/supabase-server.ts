import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { assertSupabaseEnv } from "./supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  assertSupabaseEnv("anon");

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        const value = cookieStore.get(name)?.value;
        console.log(`[SSR Cookie] Get ${name}:`, value ? "present" : "missing");
        return value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set(name, value, options);
          console.log(`[SSR Cookie] Set ${name}:`, "success");
        } catch (error) {
          console.error(`[SSR Cookie] Set ${name} failed:`, error);
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
          console.log(`[SSR Cookie] Remove ${name}:`, "success");
        } catch (error) {
          console.error(`[SSR Cookie] Remove ${name} failed:`, error);
        }
      },
    },
  });
}
