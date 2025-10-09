import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  url.searchParams.set("message", "signedOut");
  return NextResponse.redirect(url);
}
