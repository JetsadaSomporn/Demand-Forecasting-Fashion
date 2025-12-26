import { NextResponse } from "next/server";
import { callLlamaChat, ChatMessage } from "@/lib/llm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ success: true, saved: false }); 
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Context Window: Analyze the last few exchanges to find new facts
    const recentMessages = messages.slice(-6); 

    const extractionMessages: ChatMessage[] = [
        {
            role: "system",
            content: `You are a memory extraction engine.
Your goal is to extract new, concise, and permanent facts about the USER from the dialogue.

Guidelines:
1. Extract FACTS: User preferences, personal details, project goals, specific constraints, or declared opinions.
2. Ignore CHATTER: Greetings, transient questions ("How do I...?"), or references to the immediate conversation flow.
3. Ignore ASSISTANT: Do not save what the AI said, only what the User implied or stated.
4. Format: Return ONLY a raw JSON array of strings. e.g. ["User prefers TypeScript", "User is building a forecasting app"].
5. If no new facts are found, return exactly: "[]".

Do not wrap in markdown. Do not add explanations.`
        },
        ...recentMessages
    ];

    const extracted = await callLlamaChat(extractionMessages, {
        model: "meta/llama-3.3-70b-instruct",
        temperature: 0.1,
        maxTokens: 500
    });

    if (!extracted) {
        return NextResponse.json({ success: true, saved: false });
    }

    let memories: string[] = [];
    try {
        const cleanJson = extracted.replace(/```json/g, "").replace(/```/g, "").trim();
        // Handle case where model returns "[]" or similar
        if (cleanJson === "[]" || cleanJson === "NO_MEMORY") {
             return NextResponse.json({ success: true, saved: false });
        }
        memories = JSON.parse(cleanJson);
    } catch (e) {
        // Silent fail on parse error
        return NextResponse.json({ success: false });
    }

    if (Array.isArray(memories) && memories.length > 0) {
        const rows = memories.map(m => ({
            user_id: user.id,
            memory_text: m
        }));

        const { error } = await supabase.from('user_memories').insert(rows);
        
        if (error) {
            console.error("Supabase insert error", error);
            return NextResponse.json({ success: false, error: error.message });
        }
        
        return NextResponse.json({ success: true, saved: true, count: memories.length });
    }

    return NextResponse.json({ success: true, saved: false });

  } catch (error) {
    console.error("[Memory API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
