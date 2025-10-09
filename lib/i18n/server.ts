import { cookies } from "next/headers";
import { createTranslator, resolveLanguage, type Language } from "./index";

export async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("df_lang")?.value;
  return resolveLanguage(cookieValue);
}

export async function getServerTranslator() {
  const language = await getServerLanguage();
  return createTranslator(language);
}
