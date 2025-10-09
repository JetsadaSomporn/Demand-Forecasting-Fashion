import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let browserClient: SupabaseClient | null = null;

export function assertSupabaseEnv(kind: "anon" | "service") {
  if (!SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (kind === "anon" && !SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
  }

  if (kind === "service" && !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }
}

export function getSupabaseBrowserClient() {
  assertSupabaseEnv("anon");

  if (browserClient) {
    return browserClient;
  }

  // Use @supabase/ssr createBrowserClient for automatic cookie management
  browserClient = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

  return browserClient;
}

export function createSupabaseServiceClient() {
  assertSupabaseEnv("service");

  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "fashion-demand-forecast-demo",
      },
    },
  });
}

export function isSupabaseConfigured(kind: "anon" | "service" = "anon") {
  if (!SUPABASE_URL) return false;
  if (kind === "anon") return Boolean(SUPABASE_ANON_KEY);
  return Boolean(SUPABASE_SERVICE_ROLE_KEY);
}
