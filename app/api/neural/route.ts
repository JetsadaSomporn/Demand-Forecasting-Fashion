import { NextResponse } from "next/server";
import { callLlamaChat, ChatMessage } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const responseContent = await callLlamaChat(messages);

    if (!responseContent) {
      return NextResponse.json(
        { error: "Failed to generate response from Neural" },
        { status: 500 }
      );
    }

    return NextResponse.json({ role: "assistant", content: responseContent });
  } catch (error) {
    console.error("[Neural API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
