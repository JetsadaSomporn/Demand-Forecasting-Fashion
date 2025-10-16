import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Force dynamic rendering to ensure fresh session check
export const dynamic = 'force-dynamic';

export default async function RoutesLayout({
  children,
}: {
  children: ReactNode;
}) {

  const supabase = await createSupabaseServerClient();
  
  // Use getUser() instead of getSession() to validate with Supabase server
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log("[SSR] Supabase user:", user?.id, userError?.message);

  if (!user || userError) {
    console.warn("[SSR] No valid user found, redirecting to /login");
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  console.log("[SSR] Profile:", profile, profileError);

  const displayName =
    profile?.display_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  if (!profile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
    });
    if (insertError) console.error("[SSR] Insert profile error:", insertError);
  }

  return (
    <AppShell
      user={{
        email: user.email,
        displayName,
      }}
    >
      {children}
    </AppShell>
  );
}
