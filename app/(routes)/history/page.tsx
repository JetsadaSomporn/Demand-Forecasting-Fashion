import HistoryTable from "@/components/HistoryTable";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";
import { getForecastHistory, getSettingsDefaults } from "@/lib/queries";
import { cardClassName, headingClassName, subtleTextClassName } from "@/lib/theme";
import { getServerTranslator } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type HistoryPageProps = {
  searchParams?: Promise<{
    focus?: string;
  }>;
};

export const metadata = {
  title: "History · Fashion Demand",
};

// Cache history page for 2 minutes
export const revalidate = 120;

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
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
        description={t("authRequired.historyDescription")}
        actionLabel={t("authRequired.cta")}
      />
    );
  }

  const [history, settings] = await Promise.all([getForecastHistory(), getSettingsDefaults()]);
  const params = await searchParams;

  if (!history.length) {
    return (
      <section className={cardClassName + " flex flex-col items-center justify-center gap-3 p-8 text-center"}>
        <h2 className={headingClassName}>{t("history.emptyTitle")}</h2>
        <p className={subtleTextClassName}>{t("history.emptyDescription")}</p>
      </section>
    );
  }

  return <HistoryTable entries={history} initialId={params?.focus} defaultCurrency={settings.currency} />;
}
