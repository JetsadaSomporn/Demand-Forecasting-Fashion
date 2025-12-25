"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import { Send, Sparkles, User, Bot, StopCircle, Menu, MessageSquare, Plus, X, History } from "lucide-react";
import { useTranslation } from "@/lib/i18n/client";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

export default function NeuralPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load history
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
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const currentMessages = [...messages, userMessage];
    
    setMessages(currentMessages);
    setInput("");
    setIsLoading(true);
    
    // Reset textarea height
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

      // Update Session ID if returned (new session created)
      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId && newSessionId !== sessionId) {
          setSessionId(newSessionId);
          loadSessions(); // Refresh list
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
        
        // Update the last message
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

  return (
    <div className="flex h-[calc(100vh-60px)] pt-24 overflow-hidden relative">
        
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
          "absolute md:relative z-50 h-full w-[280px] shrink-0 border-r border-white/10 bg-[#04040a]/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 md:bg-transparent",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
          <div className="flex h-full flex-col p-4">
              <button 
                onClick={startNewChat}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors mb-6"
              >
                  <Plus className="h-4 w-4" />
                  <span>New Chat</span>
              </button>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 pl-2">Recent</div>
                  {sessions.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-white/30">
                          No history yet
                      </div>
                  ) : (
                      sessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={clsx(
                                "w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-3",
                                sessionId === session.id 
                                    ? "bg-accent/10 text-accent" 
                                    : "text-white/70 hover:bg-white/5 hover:text-white"
                            )}
                          >
                              <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                              <span className="truncate">{session.title || "Untitled Chat"}</span>
                          </button>
                      ))
                  )}
              </div>
          </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative w-full max-w-full">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center px-4 py-2 border-b border-white/5">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-white/70 hover:text-white"
              >
                  <Menu className="h-5 w-5" />
              </button>
              <span className="ml-3 font-display text-sm tracking-widest">NEURAL</span>
          </div>

        {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            <div className="mb-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 shadow-2xl backdrop-blur-xl">
                <Sparkles className="h-10 w-10 text-accent" />
            </div>
            <h1 className="mb-3 font-display text-3xl font-bold tracking-tight text-white">
                How can I help you?
            </h1>
            <p className="max-w-md text-white/50 text-base leading-relaxed">
                I can help you analyze trends, forecast demand, or just chat.
            </p>
            </div>
        ) : (
            <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-8 scrollbar-hide"
            >
            {messages.map((msg, idx) => (
                <div
                key={idx}
                className={clsx(
                    "group flex w-full max-w-3xl mx-auto gap-5",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
                >
                <div className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm mt-1",
                    msg.role === "assistant" 
                        ? "bg-gradient-to-br from-accent/20 to-purple-500/20 ring-1 ring-white/10" 
                        : "bg-white/10 ring-1 ring-white/20"
                )}>
                    {msg.role === "assistant" ? (
                        <Sparkles className="h-4 w-4 text-accent" />
                    ) : (
                        <User className="h-4 w-4 text-white/90" />
                    )}
                </div>
                
                <div className={clsx(
                    "flex flex-col max-w-[85%] md:max-w-[75%]",
                    msg.role === "user" ? "items-end" : "items-start"
                )}>
                    {msg.role === "assistant" && (
                        <span className="mb-2 ml-1 text-[11px] font-medium uppercase tracking-widest text-white/40">Neural</span>
                    )}
                    <div
                    className={clsx(
                        "rounded-2xl px-6 py-4 text-[15px] leading-relaxed shadow-sm",
                        msg.role === "user"
                        ? "bg-accent text-white rounded-tr-sm"
                        : "bg-white/5 text-white/90 rounded-tl-sm ring-1 ring-white/10 backdrop-blur-sm"
                    )}
                    >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                </div>
                </div>
            ))}
            {isLoading && (
               <div className="flex w-full max-w-3xl mx-auto gap-5">
                   <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 ring-1 ring-white/10 mt-1">
                        <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                   </div>
                   <div className="flex items-center space-x-1.5 rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-white/10">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce"></div>
                   </div>
               </div> 
            )}
            </div>
        )}

        {/* Input Area */}
        <div className="w-full bg-gradient-to-t from-[#04040a] to-transparent pt-10 pb-6 px-4 md:px-8">
            <div className="mx-auto max-w-3xl relative">
            <div className="relative flex items-end gap-3 rounded-[28px] border border-white/10 bg-[#121623]/80 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black/20 transition-all focus-within:border-white/20 focus-within:bg-[#1e2234]/90">
                <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Neural..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-5 py-3.5 text-[15px] text-white placeholder:text-white/30 outline-none scrollbar-hide max-h-[200px]"
                />
                <div className="pb-1.5 pr-1.5">
                    {isLoading ? (
                        <button
                            onClick={handleStop}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                        >
                            <StopCircle className="h-5 w-5" />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSubmit()}
                            disabled={!input.trim()}
                            className={clsx(
                            "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                            input.trim() 
                                ? "bg-accent text-white hover:bg-accent/90 hover:scale-105 shadow-lg shadow-accent/25" 
                                : "bg-white/5 text-white/20 cursor-not-allowed"
                            )}
                        >
                            <Send className="h-5 w-5 ml-0.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[11px] text-white/30">
                <span>Nemotron Ultra 3.1</span>
            </div>
            </div>
        </div>
      </main>
    </div>
  );
}
