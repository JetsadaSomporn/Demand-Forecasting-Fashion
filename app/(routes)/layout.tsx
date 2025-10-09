import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function RoutesLayout({
  children,
}: {
  children: ReactNode;
}) {

  const supabase = await createSupabaseServerClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  console.log("[SSR] Supabase session:", session, sessionError);

  if (!session) {
    console.warn("[SSR] No session found, redirecting to /login");
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.user.id)
    .maybeSingle();

  console.log("[SSR] Profile:", profile, profileError);

  const displayName =
    profile?.display_name ??
    (session.user.user_metadata?.full_name as string | undefined) ??
    null;

  if (!profile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: session.user.id,
      email: session.user.email,
      display_name: displayName,
    });
    if (insertError) console.error("[SSR] Insert profile error:", insertError);
  }

  return (
    <AppShell
      user={{
        email: session.user.email,
        displayName,
      }}
    >
      {children}
    </AppShell>
  );
}
