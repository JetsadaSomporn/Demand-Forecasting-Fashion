import ForecastForm from "@/components/ForecastForm";

export const metadata = {
  title: "Forecast · Fashion Demand",
};

// Cache forecast page for 5 minutes
export const revalidate = 300;

export default function ForecastPage() {
  return <ForecastForm />;
}
