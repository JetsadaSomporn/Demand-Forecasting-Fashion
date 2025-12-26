import { NextResponse } from "next/server";
import { getLlamaChatStream, ChatMessage } from "@/lib/llm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages, sessionId, isReasoning } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    // 1. Auth & Session Management
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    let currentSessionId = sessionId;
    
    // Fetch user preferences (Memory)
    let useMemory = true;
    
    if (user) {
        if (!currentSessionId) {
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

        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
             await supabase.from('chat_messages').insert({
                 session_id: currentSessionId,
                 role: 'user',
                 content: lastMsg.content
             });
        }

        try {
            const { data: settings } = await supabase
                .from('settings')
                .select('use_memory')
                .limit(1)
                .maybeSingle();
            
            if (settings && settings.use_memory !== null && settings.use_memory !== undefined) {
                useMemory = settings.use_memory;
            }
        } catch (e) {
            console.warn("Failed to fetch memory settings", e);
        }
    }

    // 2. Prepare Context & Reasoning
    let llmMessages: ChatMessage[] = [...messages];
    
    if (!useMemory) {
        const lastMsg = messages[messages.length - 1];
        llmMessages = [lastMsg];
    }

    // Handle User Memories if memory is ON
    if (user && useMemory) {
         try {
             const { data: memories } = await supabase
                .from('user_memories')
                .select('memory_text')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
             
             if (memories && memories.length > 0) {
                 const memoryContext = "User Context / Long-term Memory:\n" + memories.map(m => `- ${m.memory_text}`).join('\n') + "\n\nUse this context to personalize your responses, but prioritize the current conversation flow.";
                 llmMessages = [{ role: 'system', content: memoryContext }, ...llmMessages];
             }
         } catch (err) {}
    }

    // Apply Reasoning Mode
    const options: any = {
        model: "nvidia/llama-3.1-nemotron-ultra-253b-v1"
    };

    if (isReasoning) {
        // Reasoning Mode: Enable detailed thinking
        llmMessages = [{ role: 'system', content: "detailed thinking on" }, ...llmMessages];

        options.temperature = 0.6;
        options.topP = 0.95;
        options.maxTokens = 4096;
        options.frequencyPenalty = 0;
        options.presencePenalty = 0;
    } else {
        // Standard Mode: Disable detailed thinking explicitly
        llmMessages = [{ role: 'system', content: "detailed thinking off" }, ...llmMessages];
        
        options.temperature = 0; // As requested for non-reasoning
        options.topP = 0.95;
        options.maxTokens = 4096;
        options.frequencyPenalty = 0;
        options.presencePenalty = 0;
    }

    // 3. Call LLM
    const response = await getLlamaChatStream(llmMessages, options);
    if (!response || !response.body) {
       return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }

    // 4. Transform Stream
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
                } catch (e) {}
            }
        }
      },
      async flush(controller) {
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
