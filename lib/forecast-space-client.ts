import { forecastResponseSchema, type ForecastRequest, type ForecastResponse } from "@/lib/validators";

type ForecastSpaceOptions = {
  signal?: AbortSignal;
};

/**
 * Gradio Spaces (v5+) expose a queue-based API.
 * 1) POST to /gradio_api/call/predict with JSON string input -> receive { event_id } almost instantly.
 * 2) Open an SSE stream at /gradio_api/call/predict/{event_id} and wait for `event: complete`.
 *
 * เราแยก logic ไว้บน client เพื่อให้ backend Vercel ไม่ต้องค้างรอนานเกิน timeout.
 * ถ้ากลับมาใช้ API route แบบเดิม ให้อ่าน/comment โค้ดส่วนนี้แล้วสลับกลับได้เลย.
 */
export async function fetchForecastFromSpace(
  baseUrl: string,
  payload: ForecastRequest,
  options: ForecastSpaceOptions = {}
): Promise<ForecastResponse> {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const signals = [controller.signal, options.signal].filter(Boolean) as AbortSignal[];

  const abortHandler = () => controller.abort();
  signals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  });

  try {
    const startResponse = await fetch(`${trimmedBase}/gradio_api/call/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [JSON.stringify(payload)] }),
      signal: controller.signal,
    });

    const startText = await startResponse.text();
    if (!startResponse.ok) {
      throw new Error(startText || startResponse.statusText);
    }

    let startPayload: unknown;
    try {
      startPayload = startText ? JSON.parse(startText) : {};
    } catch (error) {
      throw new Error(`Forecast service returned invalid JSON: ${(error as Error).message}`);
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

    const eventUrl = `${trimmedBase}/gradio_api/call/predict/${eventId}`;

    return await new Promise<ForecastResponse>((resolve, reject) => {
      const source = new EventSource(eventUrl, { withCredentials: false });

      const cleanup = () => {
        source.close();
        signals.forEach((signal) => signal.removeEventListener("abort", abortHandler));
      };

      const handleComplete = (dataString: string) => {
        try {
          const parsed = JSON.parse(dataString);
          const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
          const validated = forecastResponseSchema.parse(candidate);
          cleanup();
          resolve(validated);
        } catch (error) {
          cleanup();
          reject(
            new Error(
              error instanceof Error
                ? error.message
                : "Forecast service returned malformed completion payload"
            )
          );
        }
      };

      source.addEventListener("complete", (event: MessageEvent) => {
        if (!event.data) {
          cleanup();
          reject(new Error("Forecast service returned empty completion payload"));
          return;
        }
        handleComplete(event.data);
      });

      source.addEventListener("message", (event: MessageEvent) => {
        // บาง Space จะส่งผลใน message แทน complete
        if (!event.data) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && typeof parsed === "object") {
            cleanup();
            const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
            const validated = forecastResponseSchema.parse(candidate);
            resolve(validated);
          }
        } catch {
          // ignore malformed partials – จุดนี้มักเป็น keep-alive หรือ progress event
        }
      });

      source.addEventListener("error", (event) => {
        cleanup();
        reject(
          event instanceof MessageEvent && event.data
            ? new Error(String(event.data))
            : new Error("Forecast service stream error")
        );
      });

      controller.signal.addEventListener(
        "abort",
        () => {
          cleanup();
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true }
      );
    });
  } finally {
    signals.forEach((signal) => signal.removeEventListener("abort", abortHandler));
  }
}
