import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

const LOCAL_FORECAST_DIR = path.join(process.cwd(), ".data/forecasts");
const LOCAL_EXPORT_DIR = path.join(process.cwd(), ".data/exports");

type ForecastRecord = {
  id: string;
  model_name: string;
  horizon: number;
  y_pred: number[];
  y_true?: number[] | null;
  metrics?: Record<string, number> | null;
  months?: string[];
  created_at?: string;
};

async function readLocalForecast(id: string): Promise<ForecastRecord | null> {
  try {
    const raw = await fs.readFile(path.join(LOCAL_FORECAST_DIR, `${id}.json`), "utf8");
    const parsed = JSON.parse(raw);
    return {
      id,
      model_name: parsed.model_name,
      horizon: parsed.horizon,
      y_pred: parsed.y_pred ?? [],
      y_true: parsed.y_true ?? null,
      metrics: parsed.metrics ?? {},
      months:
        parsed.months ??
        parsed.params?.months ??
        parsed.params?.plot?.months ??
        [],
      created_at: parsed.created_at,
    };
  } catch {
    return null;
  }
}

async function loadForecast(id: string): Promise<ForecastRecord | null> {
  if (isSupabaseConfigured("service")) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("forecasts")
        .select("id, model_name, horizon, y_pred, y_true, metrics, params")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        return await readLocalForecast(id);
      }

      const params = (data.params as { months?: string[]; plot?: { months?: string[] } } | null) ?? null;

      return {
        id: data.id,
        model_name: data.model_name,
        horizon: data.horizon,
        y_pred: (data.y_pred as number[]) ?? [],
        y_true: (data.y_true as number[] | null) ?? null,
        metrics: (data.metrics as Record<string, number>) ?? {},
        months: params?.months ?? params?.plot?.months ?? [],
      };
    } catch (error) {
      console.error("Supabase export load error", error);
      return await readLocalForecast(id);
    }
  }

  return await readLocalForecast(id);
}

function buildCsv(record: ForecastRecord) {
  const header = "month,y_pred,y_true";
  const months = record.months && record.months.length
    ? record.months
    : Array.from({ length: record.horizon }, (_, idx) => `M${idx + 1}`);

  const rows = months.map((month, index) => {
    const pred = record.y_pred[index] ?? "";
    const actual = record.y_true?.[index] ?? "";
    return `${month},${pred},${actual}`;
  });

  return [header, ...rows].join("\n");
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("forecastId");

  if (!id) {
    return NextResponse.json({ error: "Missing forecastId" }, { status: 400 });
  }

  const record = await loadForecast(id);
  if (!record) {
    return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
  }

  const csv = buildCsv(record);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=forecast-${id}.csv`,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const forecastId = body?.forecastId as string | undefined;

    if (!forecastId) {
      return NextResponse.json({ error: "Missing forecastId" }, { status: 400 });
    }

    const record = await loadForecast(forecastId);
    if (!record) {
      return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
    }

    const csv = buildCsv(record);

    if (isSupabaseConfigured("service")) {
      try {
        const supabase = createSupabaseServiceClient();
        const pathInBucket = `exports/${forecastId}.csv`;
        await supabase.storage
          .from("exports")
          .upload(pathInBucket, Buffer.from(csv, "utf8"), {
            contentType: "text/csv",
            upsert: true,
          });
        const { data } = supabase.storage
          .from("exports")
          .getPublicUrl(pathInBucket);

        return NextResponse.json({
          exportPath: data?.publicUrl ?? null,
          message: "Export saved to Supabase storage.",
        });
      } catch (error) {
        console.error("Supabase export upload failed", error);
      }
    }

    await fs.mkdir(LOCAL_EXPORT_DIR, { recursive: true });
    const localPath = path.join(LOCAL_EXPORT_DIR, `${forecastId}.csv`);
    await fs.writeFile(localPath, csv, "utf8");

    return NextResponse.json({
      exportPath: localPath,
      message: "Export saved to local .data/exports directory.",
    });
  } catch (error) {
    console.error("Export API error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate export",
      },
      { status: 400 }
    );
  }
}
