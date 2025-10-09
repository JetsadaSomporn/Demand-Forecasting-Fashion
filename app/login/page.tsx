import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata = {
  title: "Login · Demand Forecast",
};

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/");
  }

  return <LoginForm />;
}
