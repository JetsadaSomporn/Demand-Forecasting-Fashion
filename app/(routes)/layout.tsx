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
  
  // Log cookies available in Server Component
  const { cookies: cookieStore } = await import('next/headers');
  const allCookies = (await cookieStore()).getAll();
  const supabaseCookies = allCookies.filter(c => c.name.startsWith('sb-'));
  
  console.log("[SSR Layout] 📥 Cookies available:", {
    total: allCookies.length,
    supabase: supabaseCookies.length,
    names: supabaseCookies.map(c => c.name),
  });
  
  // Use getUser() instead of getSession() to validate with Supabase server
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log("[SSR Layout] 🔐 Auth result:", {
    hasUser: !!user,
    userId: user?.id,
    error: userError?.message,
  });

  if (!user || userError) {
    console.warn("[SSR Layout] ❌ No valid user found, redirecting to /login");
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
