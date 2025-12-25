import { NextResponse } from "next/server";
import { getLlamaChatStream } from "@/lib/llm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages, sessionId, useMemory = true } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    // 1. Auth & Session Management
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    let currentSessionId = sessionId;
    
    // Only persist if user is logged in
    if (user) {
        if (!currentSessionId) {
            // Create new session
            const firstMessage = messages.find((m: any) => m.role === 'user')?.content || "New Chat";
            const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
            
            const { data: sessionData, error: sessionError } = await supabase
                .from('chat_sessions')
                .insert({
                    user_id: user.id,
                    title: title
                })
                .select()
                .single();
            
            if (!sessionError && sessionData) {
                currentSessionId = sessionData.id;
            }
        }

        // Save User Message (the last one)
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
             await supabase.from('chat_messages').insert({
                 session_id: currentSessionId,
                 role: 'user',
                 content: lastMsg.content
             });
        }
    }

    // 2. Prepare Context (Memory Handling)
    let llmMessages = [...messages];
    
    // Logic: If Memory OFF, we only send the *last* user message (and system prompt if exists).
    // We strip the previous conversation history from the LLM context window.
    if (!useMemory) {
        const lastMsg = messages[messages.length - 1];
        llmMessages = [lastMsg];
    }

    // Logic: If Memory ON, fetch User Memories (Long Term)
    if (user && useMemory) {
         try {
             const { data: memories } = await supabase
                .from('user_memories')
                .select('memory_text')
                .eq('user_id', user.id)
                .limit(10); // Limit to avoid context overflow
             
             if (memories && memories.length > 0) {
                 const memoryContext = "You have access to the following long-term memories about the user:\n" + 
                                     memories.map(m => `- ${m.memory_text}`).join('\n') + 
                                     "\n\nUse this information to personalize your response if relevant.";
                 
                 // Inject as system message at the start
                 llmMessages = [{ role: 'system', content: memoryContext }, ...llmMessages];
             }
         } catch (err) {
             console.warn("Failed to fetch memories", err);
         }
    }

    // 3. Call LLM
    const response = await getLlamaChatStream(llmMessages);
    if (!response || !response.body) {
       return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }

    // 4. Transform Stream for Client + DB
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let fullResponse = "";
    let buffer = "";

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; 
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
                try {
                    const json = JSON.parse(trimmed.slice(6));
                    const content = json.choices?.[0]?.delta?.content;
                    if (content) {
                        fullResponse += content;
                        controller.enqueue(encoder.encode(content));
                    }
                } catch (e) {
                    // ignore parse errors
                }
            }
        }
      },
      async flush(controller) {
          if (buffer) {
             const lines = buffer.split('\n');
             for (const line of lines) {
                 const trimmed = line.trim();
                 if (trimmed.startsWith("data: ")) {
                     try {
                         const json = JSON.parse(trimmed.slice(6));
                         const content = json.choices?.[0]?.delta?.content;
                         if (content) { fullResponse += content; controller.enqueue(encoder.encode(content)); }
                     } catch(e) {}
                 }
             }
          }

          // Save Assistant Message to DB
          if (user && currentSessionId && fullResponse) {
              await supabase.from('chat_messages').insert({
                 session_id: currentSessionId,
                 role: 'assistant',
                 content: fullResponse
             });
          }
      }
    });

    return new Response(response.body.pipeThrough(transformStream), {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": currentSessionId || ""
        }
    });

  } catch (error) {
    console.error("[Neural API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
