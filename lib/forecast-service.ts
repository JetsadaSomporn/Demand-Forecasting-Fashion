import { ForecastRequest } from "@/lib/validators";

const FORECAST_SERVICE_URL = process.env.FORECAST_SERVICE_URL;
const FORECAST_SERVICE_TOKEN = process.env.FORECAST_SERVICE_TOKEN;

export type PythonForecastResponse = {
  model: "lgbm_full" | "lgbm_meta";
  horizon: number;
  y_pred: number[];
  y_true?: number[] | null;
  metrics?: Record<string, number> | null;
  months: string[];
  warning?: string;
  plot?: { months?: string[]; seed?: { months?: string[]; values?: number[] } };
  error?: string;
};

export async function runRemoteInference(payload: ForecastRequest): Promise<PythonForecastResponse> {
  if (!FORECAST_SERVICE_URL) {
    throw new Error("FORECAST_SERVICE_URL environment variable is not configured");
  }

  const baseUrl = FORECAST_SERVICE_URL.replace(/\/+$/, "");
  const invokeUrl = `${baseUrl}/gradio_api/call/predict`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (FORECAST_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${FORECAST_SERVICE_TOKEN}`;
  }

  const body = JSON.stringify({ data: [JSON.stringify(payload)] });

  const response = await fetch(invokeUrl, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Forecast service error: ${rawText || response.statusText}`);
  }

  let startPayload: unknown;
  try {
    startPayload = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    throw new Error(
      `Forecast service returned invalid JSON (${(error as Error).message}): ${rawText.slice(0, 200)}`
    );
  }

  const eventId =
    typeof startPayload === "object" &&
    startPayload &&
    "event_id" in startPayload &&
    typeof (startPayload as { event_id: unknown }).event_id === "string"
      ? ((startPayload as { event_id: string }).event_id ?? "").trim()
      : "";

  if (!eventId) {
    throw new Error("Forecast service did not return an event_id");
  }

  const eventStreamUrl = `${invokeUrl}/${eventId}`;

  const eventResponse = await fetch(eventStreamUrl, {
    method: "GET",
    headers: {
      ...(FORECAST_SERVICE_TOKEN ? { Authorization: `Bearer ${FORECAST_SERVICE_TOKEN}` } : {}),
      Accept: "text/event-stream",
    },
  });

  if (!eventResponse.ok || !eventResponse.body) {
    const text = await eventResponse.text().catch(() => "");
    throw new Error(`Forecast service stream error: ${text || eventResponse.statusText}`);
  }

  const reader = eventResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const chunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      let eventType = "message";
      const dataParts: string[] = [];

      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataParts.push(line.slice(5).trim());
        }
      }

      const dataString = dataParts.join("\n");

      if (eventType === "complete") {
        if (!dataString) {
          throw new Error("Forecast service returned an empty completion payload");
        }

        let parsedResult: unknown;
        try {
          parsedResult = JSON.parse(dataString);
        } catch (error) {
          throw new Error(
            `Forecast service returned invalid completion JSON (${(error as Error).message}): ${dataString.slice(0, 200)}`
          );
        }

        const resultCandidate = Array.isArray(parsedResult) ? parsedResult[0] : parsedResult;

        if (!resultCandidate || typeof resultCandidate !== "object") {
          throw new Error("Forecast service completion payload is empty");
        }

        return resultCandidate as PythonForecastResponse;
      }

      if (eventType === "error") {
        throw new Error(dataString || "Forecast service reported an error");
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  throw new Error("Forecast service stream ended before returning a result");
}
