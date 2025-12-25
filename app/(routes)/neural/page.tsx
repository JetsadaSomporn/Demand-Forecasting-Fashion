"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Send, Sparkles, User, StopCircle, Menu, MessageSquare, Plus, Paperclip, Brain, X, FileText } from "lucide-react";
import { useTranslation } from "@/lib/i18n/client";
import ReactMarkdown from "react-markdown";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

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
    
    if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
    }

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
            content: "Sorry, connection interrupted. Please try again." 
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

  if (isCheckingAuth) {
      return (
          <div className="min-h-screen bg-[#04040a] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                  <div className="h-6 w-6 rounded-full border border-white/20 border-t-white animate-spin" />
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#04040a] text-white/90 font-sans overflow-hidden selection:bg-white/20">
      
      {isSidebarOpen && (
        <div 
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Floating Sidebar (Desktop) */}
      <aside className={clsx(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-[#04040a]/95 backdrop-blur-xl border-r border-white/[0.06] transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
          <div className="flex flex-col h-full pt-20 px-3 pb-4"> {/* pt-20 to clear fixed header if any */}
              <button 
                onClick={startNewChat}
                className="group flex items-center gap-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white transition-all hover:bg-white/[0.08] hover:border-white/20 mb-6"
              >
                  <Plus className="h-4 w-4 text-white/60 group-hover:text-white" />
                  <span className="font-medium tracking-wide">New Thread</span>
              </button>

              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar -mr-2 pr-2">
                  <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">History</div>
                  {sessions.length === 0 ? (
                      <div className="px-3 py-8 text-center text-xs text-white/20 italic">
                          No history yet
                      </div>
                  ) : (
                      sessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={clsx(
                                "w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition-all flex items-center gap-3 group relative overflow-hidden",
                                sessionId === session.id 
                                    ? "bg-white/[0.08] text-white" 
                                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                            )}
                          >
                              <MessageSquare className={clsx(
                                  "h-3.5 w-3.5 shrink-0 transition-opacity",
                                  sessionId === session.id ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                              )} />
                              <span className="truncate relative z-10">{session.title || "Untitled Chat"}</span>
                          </button>
                      ))
                  )}
              </div>
          </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative">
          
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#04040a]/80 backdrop-blur-md sticky top-0 z-30">
              <button onClick={() => setIsSidebarOpen(true)}>
                  <Menu className="h-5 w-5 text-white/70" />
              </button>
              <span className="text-sm font-medium tracking-wide">NEURAL</span>
              <div className="w-5" />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide relative pt-20 pb-32"> {/* Added padding for header/input */}
            {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 animate-in fade-in duration-1000 zoom-in-95">
                    <div className="w-full max-w-md text-center space-y-8">
                        <div className="relative inline-flex items-center justify-center">
                            <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full opacity-20" />
                            <div className="relative p-6 rounded-3xl bg-white/[0.03] ring-1 ring-white/10 backdrop-blur-xl">
                                <Sparkles className="h-10 w-10 text-white/90" strokeWidth={1} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-4xl font-light tracking-tight text-white mix-blend-overlay">
                                Neural
                            </h1>
                            <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
                                Advanced reasoning & fashion intelligence.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-3xl mx-auto px-4 space-y-12" ref={scrollRef}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={clsx("flex gap-6", msg.role === "user" ? "justify-end" : "justify-start")}>
                            {msg.role === "assistant" && (
                                <div className="h-8 w-8 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0 mt-1 ring-1 ring-white/5">
                                    <Sparkles className="h-4 w-4 text-white/70" strokeWidth={1.5} />
                                </div>
                            )}
                            
                            <div className={clsx(
                                "max-w-[85%]",
                                msg.role === "user" 
                                    ? "bg-white/[0.08] backdrop-blur-md border border-white/5 text-white px-6 py-4 rounded-3xl rounded-tr-sm" 
                                    : "text-white/90 py-2"
                            )}>
                                {msg.role === "user" ? (
                                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-light">{msg.content}</div>
                                ) : (
                                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-7 prose-p:text-white/80 prose-headings:font-medium prose-headings:text-white prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-code:text-blue-300 prose-strong:text-white">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-6 max-w-3xl mx-auto px-4">
                            <div className="h-8 w-8 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0 ring-1 ring-white/5">
                                <Sparkles className="h-4 w-4 text-white/70 animate-pulse" strokeWidth={1.5} />
                            </div>
                            <div className="flex items-center gap-1.5 h-8">
                                <span className="h-1 w-1 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="h-1 w-1 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="h-1 w-1 rounded-full bg-white/40 animate-bounce"></span>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="w-full px-4 pb-8 pt-4 fixed bottom-0 md:pl-[280px] pointer-events-none">
              <div className="max-w-3xl mx-auto pointer-events-auto">
                  
                  {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 px-1 animate-in slide-in-from-bottom-2 fade-in">
                          {files.map((file, i) => (
                              <div key={i} className="flex items-center gap-2 bg-[#1c1c1f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 shadow-lg">
                                  <FileText className="h-3.5 w-3.5 text-white/50" />
                                  <span className="truncate max-w-[150px]">{file.name}</span>
                                  <button onClick={() => removeFile(i)} className="hover:text-white ml-1">
                                      <X className="h-3.5 w-3.5" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  <div className="relative bg-[#09090b]/80 border border-white/10 rounded-3xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-2xl ring-1 ring-white/5 focus-within:ring-white/10 focus-within:border-white/20 transition-all overflow-hidden group">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything..."
                        className="w-full bg-transparent border-none text-white px-5 py-4 text-[15px] placeholder:text-white/20 focus:ring-0 resize-none max-h-[200px] scrollbar-hide outline-none"
                        rows={1}
                      />
                      
                      <div className="flex items-center justify-between px-3 pb-3">
                          <div className="flex items-center gap-1.5">
                              <input 
                                type="file" 
                                multiple 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                              />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-white/40 hover:text-white/90 hover:bg-white/5 rounded-xl transition-colors"
                                title="Attach file"
                              >
                                  <Paperclip className="h-4 w-4" />
                              </button>
                              
                              <button 
                                onClick={() => setIsReasoning(!isReasoning)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                                    isReasoning 
                                        ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]" 
                                        : "bg-transparent text-white/40 border-transparent hover:bg-white/5 hover:text-white/80"
                                )}
                                title="Toggle Reasoning Model"
                              >
                                  <Brain className="h-3.5 w-3.5" />
                                  <span>Reasoning</span>
                              </button>
                          </div>

                          <div className="flex items-center">
                                {isLoading ? (
                                    <button 
                                        onClick={handleStop}
                                        className="p-2 bg-white/10 rounded-xl text-white hover:bg-white/20"
                                    >
                                        <StopCircle className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleSubmit()}
                                        disabled={!input.trim() && files.length === 0}
                                        className={clsx(
                                            "p-2 rounded-xl transition-all duration-300",
                                            (input.trim() || files.length > 0)
                                                ? "bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                                                : "bg-white/5 text-white/20 cursor-not-allowed"
                                        )}
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                )}
                          </div>
                      </div>
                  </div>
                  <div className="text-center mt-4 text-[10px] text-white/10 font-medium tracking-[0.2em] uppercase mix-blend-overlay">
                      Neural Intelligence
                  </div>
              </div>
          </div>
      </main>
    </div>
  );
}