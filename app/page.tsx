import { getServerTranslator } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import LandingClient from "@/components/LandingClient";

// Cache landing page for 5 minutes
export const revalidate = 300;

export default async function LandingPage() {
  const translator = await getServerTranslator();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user && !userError);
  const accountLabel = isAuthenticated
    ? (user?.user_metadata?.full_name as string | undefined) ??
      user?.email ??
      translator.t("common.accountFallback")
    : translator.t("common.guestLabel");

  const navItems = [
    { href: "/forecast", label: translator.t("nav.forecast") },
    { href: "/history", label: translator.t("nav.history") },
    { href: "/neural", label: translator.t("nav.neural") },
    { href: "/settings", label: translator.t("nav.settings") },
  ];

  return (
    <LandingClient 
      navItems={navItems}
      accountLabel={accountLabel}
      isAuthenticated={isAuthenticated}
    />
  );
}
