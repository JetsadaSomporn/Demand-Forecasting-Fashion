"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { 
  Send, Sparkles, StopCircle, Menu, MessageSquare, 
  Plus, Paperclip, Brain, X, FileText, ChevronLeft,
  Settings, History
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getSupabaseBrowserClient } from "@/lib/supabase";

// --- Types ---
type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

type AttachedFile = {
  name: string;
  content: string;
  size: number;
};

export default function NeuralPage() {
  const router = useRouter();
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed for minimalism
  const [isReasoning, setIsReasoning] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auth Check
  useEffect(() => {
    const checkAuth = async () => {
        try {
            const supabase = getSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login?next=/neural");
            } else {
                setIsCheckingAuth(false);
            }
        } catch (e) {
            console.error("Auth check failed", e);
            router.push("/login");
        }
    };
    checkAuth();
  }, [router]);

  // Load History
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/neural/history');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const loadSession = async (id: string) => {
    setIsLoading(true);
    setSessionId(id);
    setIsSidebarOpen(false);
    try {
      const res = await fetch(`/api/neural/history?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
    setInput("");
    setFiles([]);
  };

  useEffect(() => {
    if (!isCheckingAuth) {
        loadSessions();
    }
  }, [loadSessions, isCheckingAuth]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        // Smooth scroll to bottom
        scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth"
        });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // File Handling
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles: AttachedFile[] = [];
          for (const file of Array.from(e.target.files)) {
              if (file.size > 1024 * 1024) { 
                  alert(`File ${file.name} is too large (max 1MB for text analysis)`);
                  continue;
              }
              try {
                  const text = await file.text();
                  newFiles.push({
                      name: file.name,
                      content: text,
                      size: file.size
                  });
              } catch (err) {
                  console.error("Failed to read file", err);
              }
          }
          setFiles(prev => [...prev, ...newFiles]);
          if (fileInputRef.current) fileInputRef.current.value = "";
      }
  };

  const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && files.length === 0) || isLoading) return;

    let fullContent = input;
    if (files.length > 0) {
        fullContent += "\n\n" + files.map(f => `--- File: ${f.name} ---\n${f.content}\n--- End File ---`).join("\n\n");
    }

    const userMessage: Message = { role: "user", content: fullContent };
    const currentMessages = [...messages, userMessage];
    
    setMessages(currentMessages);
    setInput("");
    setFiles([]);
    setIsLoading(true);
    
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/neural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages: currentMessages, 
            sessionId,
            isReasoning 
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId && newSessionId !== sessionId) {
          setSessionId(newSessionId);
          loadSessions();
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantMessage = { role: "assistant", content: "" } as Message;
      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        assistantMessage.content += text;
        
        setMessages((prev) => {
            const newPrev = [...prev];
            newPrev[newPrev.length - 1] = { ...assistantMessage };
            return newPrev;
        });
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        const errorMessage: Message = { 
            role: "assistant", 
            content: "Connection interrupted. Please try again." 
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          setIsLoading(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isCheckingAuth) return null;

  return (
    <div className="relative flex h-screen w-full flex-col bg-zinc-950 text-zinc-200 font-sans selection:bg-white/10">
      
      {/* --- Sidebar Overlay --- */}
      {isSidebarOpen && (
        <div 
          className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- Sidebar (Slide-over) --- */}
      <div className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900/95 border-r border-white/5 shadow-2xl transform transition-transform duration-300 ease-in-out backdrop-blur-xl",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">History</h2>
             <button onClick={() => setIsSidebarOpen(false)} className="text-white/40 hover:text-white">
                 <X className="w-5 h-5" />
             </button>
          </div>

          <button 
             onClick={startNewChat}
             className="flex items-center gap-3 w-full rounded-lg bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors mb-4"
          >
             <Plus className="w-4 h-4" />
             <span>New Conversation</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
             {sessions.map(session => (
                 <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={clsx(
                        "w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors",
                        sessionId === session.id 
                           ? "bg-white/10 text-white" 
                           : "text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                 >
                     {session.title || "Untitled"}
                 </button>
             ))}
          </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <header className="absolute top-0 left-0 w-full z-10 p-4 flex justify-between items-center bg-gradient-to-b from-zinc-950/80 to-transparent pointer-events-none">
         <button 
           onClick={() => setIsSidebarOpen(true)}
           className="pointer-events-auto p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
         >
             <Menu className="w-5 h-5" />
         </button>
         <div className="text-xs font-medium text-zinc-600 tracking-widest uppercase">
            Neural Engine
         </div>
         <div className="w-9" /> {/* Spacer for centering */}
      </header>

      <main className="flex-1 flex flex-col items-center relative w-full max-w-5xl mx-auto pt-20">
          
          <div className="flex-1 w-full overflow-y-auto px-4 scrollbar-hide" ref={scrollRef}>
             {messages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                     <div className="p-4 rounded-2xl bg-white/5 ring-1 ring-white/10">
                         <Sparkles className="w-8 h-8 text-white" strokeWidth={1} />
                     </div>
                     <div>
                         <h1 className="text-2xl font-light text-white">How can I help?</h1>
                     </div>
                 </div>
             ) : (
                 <div className="flex flex-col gap-6 pb-32">
                     {messages.map((msg, idx) => (
                         <div key={idx} className={clsx(
                             "flex w-full gap-4",
                             msg.role === "user" ? "justify-end" : "justify-start"
                         )}>
                             
                             {/* Assistant Avatar */}
                             {msg.role === "assistant" && (
                                 <div className="shrink-0 w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center mt-1">
                                     <Sparkles className="w-4 h-4 text-teal-400" />
                                 </div>
                             )}

                             <div className={clsx(
                                 "relative max-w-2xl px-5 py-3.5 text-[15px] leading-7",
                                 msg.role === "user" 
                                    ? "bg-white/10 text-white rounded-2xl rounded-tr-sm" 
                                    : "text-zinc-300"
                             )}>
                                 {msg.role === "assistant" ? (
                                    <div className="prose prose-invert prose-sm max-w-none 
                                        prose-p:leading-7 prose-headings:text-zinc-100 prose-strong:text-zinc-100 
                                        prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
                                        prose-code:text-teal-300 prose-code:bg-zinc-900/50 prose-code:px-1 prose-code:rounded">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                 ) : (
                                     <div className="whitespace-pre-wrap">{msg.content}</div>
                                 )}
                             </div>
                         </div>
                     ))}
                     {isLoading && (
                         <div className="flex w-full gap-4 justify-start">
                             <div className="shrink-0 w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center mt-1">
                                 <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                             </div>
                             <div className="flex items-center gap-1 h-8 px-2">
                                 <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                 <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                 <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" />
                             </div>
                         </div>
                     )}
                 </div>
             )}
          </div>

          {/* --- Input Area --- */}
          <div className="w-full px-4 pb-6 pt-2">
              <div className="relative max-w-3xl mx-auto">
                  
                  {/* File Previews */}
                  {files.length > 0 && (
                    <div className="flex gap-2 mb-2 px-1 overflow-x-auto">
                        {files.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 bg-zinc-800/50 rounded-full px-3 py-1 text-xs text-zinc-300 border border-white/5">
                                <FileText className="w-3 h-3" />
                                <span className="truncate max-w-[100px]">{f.name}</span>
                                <button onClick={() => removeFile(i)} className="hover:text-white"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                  )}

                  <div className="relative group bg-zinc-900/50 backdrop-blur-xl border border-white/5 focus-within:border-white/10 focus-within:bg-zinc-900 rounded-[2rem] transition-all shadow-lg shadow-black/20">
                      
                      <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Ask anything..."
                          className="w-full bg-transparent border-none text-zinc-200 px-6 py-4 pr-32 min-h-[56px] max-h-48 resize-none focus:ring-0 placeholder:text-zinc-600"
                          rows={1}
                      />

                      <div className="absolute bottom-2 right-2 flex items-center gap-1">
                          
                          {/* Attach */}
                          <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                          <button 
                             onClick={() => fileInputRef.current?.click()}
                             className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full transition-colors"
                          >
                              <Paperclip className="w-4 h-4" />
                          </button>

                          {/* Reasoning Toggle */}
                          <button 
                             onClick={() => setIsReasoning(!isReasoning)}
                             className={clsx(
                                 "flex items-center justify-center p-2 rounded-full transition-all border",
                                 isReasoning 
                                    ? "bg-teal-500/10 text-teal-400 border-teal-500/20" 
                                    : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
                             )}
                             title="Reasoning Mode"
                          >
                              <Brain className="w-4 h-4" />
                          </button>

                          {/* Send / Stop */}
                          {isLoading ? (
                              <button onClick={handleStop} className="p-2 bg-zinc-800 rounded-full text-zinc-200 hover:bg-zinc-700">
                                  <StopCircle className="w-4 h-4" />
                              </button>
                          ) : (
                              <button 
                                 onClick={() => handleSubmit()}
                                 disabled={!input.trim() && files.length === 0}
                                 className={clsx(
                                     "p-2 rounded-full transition-all",
                                     (input.trim() || files.length > 0)
                                        ? "bg-zinc-100 text-black hover:bg-white hover:scale-105" 
                                        : "bg-zinc-800 text-zinc-600"
                                 )}
                              >
                                  <Send className="w-4 h-4" />
                              </button>
                          )}
                      </div>
                  </div>
                  
                  <div className="text-center mt-3 text-[10px] text-zinc-700 font-medium tracking-widest uppercase">
                      Neural v2.0
                  </div>

              </div>
          </div>

      </main>
    </div>
  );
}
