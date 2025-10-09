import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { settingsSchema, type SettingsFormValues } from "@/lib/validators";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

const SETTINGS_PATH = path.join(process.cwd(), ".data/settings.json");

async function writeLocalSettings(values: SettingsFormValues) {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(values, null, 2), "utf8");
}

async function readSupabaseSettingsId() {
  try {
    const supabase = createSupabaseServiceClient();
    const existing = await supabase
      .from("settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    return existing.data?.id as string | undefined;
  } catch (error) {
    console.error("Supabase settings lookup failed", error);
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = settingsSchema.parse(raw);

    const supabaseConfigured = isSupabaseConfigured("service");
    let persistedToSupabase = false;

    if (supabaseConfigured) {
      try {
        const supabase = createSupabaseServiceClient();
        const existingId = await readSupabaseSettingsId();

        if (existingId) {
          await supabase
            .from("settings")
            .update({
              display_name: parsed.displayName,
              brand_name: parsed.brandName,
              timezone: parsed.timezone,
              currency: parsed.currency,
              language: parsed.language,
            })
            .eq("id", existingId);
        } else {
          await supabase
            .from("settings")
            .insert({
              display_name: parsed.displayName,
              brand_name: parsed.brandName,
              timezone: parsed.timezone,
              currency: parsed.currency,
              language: parsed.language,
            });
        }
        persistedToSupabase = true;
      } catch (error) {
        console.error("Supabase settings write failed", error);
        throw new Error("ไม่สามารถบันทึกการตั้งค่าไปยัง Supabase ได้");
      }
    }

    if (!persistedToSupabase) {
      await writeLocalSettings(parsed);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Settings API error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 400 }
    );
  }
}
