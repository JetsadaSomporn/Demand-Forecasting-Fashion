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

  // Auth Guard
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
              if (file.size > 1024 * 1024) { // 1MB limit for text for now
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
          // Reset input
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

    if (isReasoning) {
        fullContent = "[Reasoning Mode: Enabled. Please think step-by-step and provide a detailed, logical analysis.]\n\n" + fullContent;
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
        body: JSON.stringify({ messages: currentMessages, sessionId }),
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
                  <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span className="text-white/40 text-xs tracking-widest uppercase">Authenticating</span>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#04040a] text-white font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Collapsible & Modern */}
      <aside className={clsx(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-[#09090b] border-r border-white/5 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
          <div className="p-4 flex flex-col h-full">
              <button 
                onClick={startNewChat}
                className="flex items-center gap-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-all hover:border-white/20 mb-6 group"
              >
                  <Plus className="h-4 w-4 text-white/70 group-hover:text-white" />
                  <span className="font-medium">New Thread</span>
              </button>

              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar -mr-2 pr-2">
                  <div className="px-2 mb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">Recent</div>
                  {sessions.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-white/20 italic">
                          No history yet
                      </div>
                  ) : (
                      sessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={clsx(
                                "w-full truncate rounded-md px-2 py-2 text-left text-sm transition-all flex items-center gap-2.5",
                                sessionId === session.id 
                                    ? "bg-white/10 text-white" 
                                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                            )}
                          >
                              <span className="truncate">{session.title || "Untitled Chat"}</span>
                          </button>
                      ))
                  )}
              </div>
              
              <div className="pt-4 border-t border-white/5 mt-4">
                  <div className="flex items-center gap-3 px-2 py-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 opacity-80" />
                      <div className="flex flex-col">
                          <span className="text-xs font-medium text-white/90">Account</span>
                          <span className="text-[10px] text-white/40">Pro Plan</span>
                      </div>
                  </div>
              </div>
          </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative">
          
          {/* Header (Mobile Only) */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#04040a]/80 backdrop-blur-md sticky top-0 z-30">
              <button onClick={() => setIsSidebarOpen(true)}>
                  <Menu className="h-5 w-5 text-white/70" />
              </button>
              <span className="text-sm font-medium tracking-wide">NEURAL</span>
              <div className="w-5" />
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide relative">
            {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 animate-in fade-in duration-700">
                    <div className="w-full max-w-md text-center space-y-6">
                        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-white/5 ring-1 ring-white/10 mb-4">
                            <Sparkles className="h-8 w-8 text-white/80" />
                        </div>
                        <h1 className="text-3xl font-light tracking-tight text-white/90">
                            Good afternoon.
                        </h1>
                        <p className="text-white/40 text-sm leading-relaxed">
                            I can help you analyze documents, reason through complex problems, or draft content.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-10" ref={scrollRef}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={clsx("flex gap-4", msg.role === "user" ? "justify-end" : "justify-start")}>
                            {msg.role === "assistant" && (
                                <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                                    <Sparkles className="h-3.5 w-3.5 text-white/80" />
                                </div>
                            )}
                            
                            <div className={clsx(
                                "max-w-[85%]",
                                msg.role === "user" ? "bg-[#27272a] text-white px-5 py-3 rounded-2xl" : "text-white/90"
                            )}>
                                {msg.role === "user" ? (
                                    <div className="whitespace-pre-wrap text-[15px] font-light">{msg.content.replace(/[Reasoning Mode:.*]\n\n/, "")}</div>
                                ) : (
                                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-7 prose-headings:font-medium prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 prose-code:text-blue-300">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-4 max-w-3xl mx-auto px-4">
                            <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <Sparkles className="h-3.5 w-3.5 text-white/80 animate-pulse" />
                            </div>
                            <div className="flex items-center gap-1 h-7">
                                <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div className="h-12" />
                </div>
            )}
          </div>

          {/* Floating Input Area */}
          <div className="w-full px-4 pb-6 pt-2">
              <div className="max-w-3xl mx-auto">
                  
                  {/* Attached Files Preview */}
                  {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 px-1">
                          {files.map((file, i) => (
                              <div key={i} className="flex items-center gap-2 bg-[#27272a] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white/80">
                                  <FileText className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{file.name}</span>
                                  <button onClick={() => removeFile(i)} className="hover:text-white">
                                      <X className="h-3 w-3" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  <div className="relative bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl ring-1 ring-black/20 focus-within:ring-white/10 focus-within:border-white/20 transition-all overflow-hidden">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message Neural..."
                        className="w-full bg-transparent border-none text-white px-4 py-3.5 text-[15px] placeholder:text-white/20 focus:ring-0 resize-none max-h-[200px] scrollbar-hide outline-none"
                        rows={1}
                      />
                      
                      <div className="flex items-center justify-between px-2 pb-2">
                          <div className="flex items-center gap-1">
                              <input 
                                type="file" 
                                multiple 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                              />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-white/40 hover:text-white/90 hover:bg-white/5 rounded-lg transition-colors"
                                title="Attach file"
                              >
                                  <Paperclip className="h-4 w-4" />
                              </button>
                              
                              <button 
                                onClick={() => setIsReasoning(!isReasoning)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                                    isReasoning 
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
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
                                        className="p-2 bg-white/10 rounded-lg text-white hover:bg-white/20"
                                    >
                                        <StopCircle className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleSubmit()}
                                        disabled={!input.trim() && files.length === 0}
                                        className={clsx(
                                            "p-2 rounded-lg transition-all",
                                            (input.trim() || files.length > 0)
                                                ? "bg-white text-black hover:bg-white/90" 
                                                : "bg-white/5 text-white/20 cursor-not-allowed"
                                        )}
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                )}
                          </div>
                      </div>
                  </div>
                  <div className="text-center mt-3 text-[10px] text-white/20 font-medium tracking-widest uppercase">
                      Neural Intelligence
                  </div>
              </div>
          </div>
      </main>
    </div>
  );
}