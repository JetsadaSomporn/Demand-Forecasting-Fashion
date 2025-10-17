import ForecastForm from "@/components/ForecastForm";
import { getSettingsDefaults } from "@/lib/queries";

export const metadata = {
  title: "Forecast · Fashion Demand",
};

// Cache forecast page for 5 minutes
export const revalidate = 300;

export default async function ForecastPage() {
  const defaults = await getSettingsDefaults();
  return <ForecastForm currency={defaults.currency} />;
}
