import HistoryTable from "@/components/HistoryTable";
import { getForecastHistory } from "@/lib/queries";
import { cardClassName, headingClassName, subtleTextClassName } from "@/lib/theme";
import { getServerTranslator } from "@/lib/i18n/server";

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
  const history = await getForecastHistory();
  const params = await searchParams;
  const { t } = await getServerTranslator();

  if (!history.length) {
    return (
      <section className={cardClassName + " flex flex-col items-center justify-center gap-3 p-8 text-center"}>
        <h2 className={headingClassName}>{t("history.emptyTitle")}</h2>
        <p className={subtleTextClassName}>{t("history.emptyDescription")}</p>
      </section>
    );
  }

  return <HistoryTable entries={history} initialId={params?.focus} />;
}
