import SettingsForm from "@/components/SettingsForm";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";
import { getSettingsDefaults } from "@/lib/queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getServerTranslator } from "@/lib/i18n/server";

export const metadata = {
  title: "Settings · Fashion Demand",
};

// Cache settings page for 5 minutes
export const revalidate = 300;

export default async function SettingsPage() {
  const { t } = await getServerTranslator();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    return (
      <LoginRequiredNotice
        title={t("authRequired.title")}
        description={t("authRequired.settingsDescription")}
        actionLabel={t("authRequired.cta")}
      />
    );
  }

  const defaults = await getSettingsDefaults();

  return <SettingsForm defaults={defaults} />;
}
