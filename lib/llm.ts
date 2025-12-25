const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export type LlamaOptions = {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  model?: string;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callLlama(prompt: string, options: LlamaOptions = {}) {
  if (!NVIDIA_API_KEY) {
    console.warn("[LLM] NVIDIA_API_KEY is not configured");
    return null;
  }

  const {
    maxTokens = 200,
    temperature = 0.2,
    topP = 0.7,
    model = "meta/llama-3.3-70b-instruct",
  } = options;

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? null;
    if (!content) {
      console.error("[LLM] Missing content in response");
      return null;
    }

    return content;
  } catch (error) {
    console.error("[LLM] Request error:", error);
    return null;
  }
}

export async function callLlamaChat(messages: ChatMessage[], options: LlamaOptions = {}) {
  if (!NVIDIA_API_KEY) {
    console.warn("[LLM] NVIDIA_API_KEY is not configured");
    return null;
  }

  const {
    maxTokens = 1024,
    temperature = 0.7,
    topP = 0.9,
    model = "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  } = options;

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? null;
    if (!content) {
      console.error("[LLM] Missing content in response");
      return null;
    }

    return content;
  } catch (error) {
    console.error("[LLM] Request error:", error);
    return null;
  }
}

export async function getLlamaChatStream(messages: ChatMessage[], options: LlamaOptions = {}) {
  if (!NVIDIA_API_KEY) {
    console.warn("[LLM] NVIDIA_API_KEY is not configured");
    return null;
  }

  const {
    maxTokens = 1024,
    temperature = 0.7,
    topP = 0.9,
    model = "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    frequencyPenalty = 0,
    presencePenalty = 0,
  } = options;

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] API error:", response.status, errorText);
      return null;
    }

    return response;
  } catch (error) {
    console.error("[LLM] Request error:", error);
    return null;
  }
}