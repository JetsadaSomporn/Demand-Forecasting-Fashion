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
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
    });
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
