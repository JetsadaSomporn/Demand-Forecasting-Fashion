import SettingsForm from "@/components/SettingsForm";
import { getSettingsDefaults } from "@/lib/queries";

export const metadata = {
  title: "Settings · Fashion Demand",
};

export default async function SettingsPage() {
  const defaults = await getSettingsDefaults();

  return <SettingsForm defaults={defaults} />;
}
