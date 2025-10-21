import type { ReactNode } from "react";
import { cache } from "react";
import AppShell from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Cache layout for 5 minutes - middleware still refreshes session
export const revalidate = 300;

// Use React cache instead of unstable_cache to avoid dynamic data issues
// This caches for the duration of the request only
const getProfile = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

export default async function RoutesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let displayName: string | null = null;

  if (user && !userError) {
    // Use React cache - deduplicates queries within the same request
    const profile = await getProfile(user.id);

    displayName =
      profile?.display_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      null;

    // Only insert if profile doesn't exist (no caching on insert)
    if (!profile) {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        display_name: displayName,
      });
      if (insertError) {
        console.warn("[RoutesLayout] Failed to seed profile", insertError);
      }
    }
  }

  return (
    <AppShell
      user={
        user && !userError
          ? {
              email: user.email,
              displayName,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
