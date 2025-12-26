"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { 
  Menu, ChevronDown, User, Search, Brain, 
  Paperclip, Code, Sparkles, Globe, PenTool, 
  Presentation, LayoutGrid, Plus, ArrowUp
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState("User");
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auth & Profile Check
  useEffect(() => {
    const checkAuth = async () => {
        try {
            const supabase = getSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login?next=/neural");
            } else {
                setIsCheckingAuth(false);
                // Try to get display name
                const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
                if (profile?.display_name) setUserName(profile.display_name);
                else if (user.user_metadata?.full_name) setUserName(user.user_metadata.full_name);
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
    if (!isCheckingAuth) loadSessions();
  }, [loadSessions, isCheckingAuth]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

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
                  newFiles.push({ name: file.name, content: text, size: file.size });
              } catch (err) {
                  console.error("Failed to read file", err);
              }
          }
          setFiles(prev => [...prev, ...newFiles]);
          if (fileInputRef.current) fileInputRef.current.value = "";
      }
  };

  const handleSubmit = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && files.length === 0) || isLoading) return;

    let fullContent = textToSend;
    if (files.length > 0) {
        fullContent += "\n\n" + files.map(f => `--- File: ${f.name} ---\n${f.content}\n--- End File ---`).join("\n\n");
    }

    const userMessage: Message = { role: "user", content: fullContent };
    const currentMessages = [...messages, userMessage];
    
    setMessages(currentMessages);
    setInput("");
    setFiles([]);
    setIsLoading(true);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/neural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages, sessionId, isReasoning }),
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

      // Background Memory
      const finalContext = [...currentMessages, assistantMessage];
      fetch("/api/neural/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: finalContext })
      }).catch(err => console.error("Memory extraction failed", err));

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        const errorMessage: Message = { role: "assistant", content: "Connection interrupted." };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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
    <div className="flex h-screen w-full flex-col bg-white text-zinc-900 font-sans selection:bg-blue-100">
      
      {/* --- Header --- */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md">
         <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-600"
             >
                 <Menu className="w-5 h-5" />
             </button>
             <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-zinc-100 rounded-lg transition-colors font-medium text-zinc-800 text-sm">
                 <span>Neural-4</span>
                 <ChevronDown className="w-4 h-4 text-zinc-400" />
             </button>
         </div>

         <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200 overflow-hidden">
                <User className="w-5 h-5 text-zinc-500" />
            </button>
         </div>
      </header>

      {/* --- Sidebar (Slide-over) --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        >
            <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-semibold text-zinc-800">History</h2>
                    <button onClick={() => router.push('/forecast')} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500">
                         <LayoutGrid className="w-5 h-5" />
                    </button>
                </div>
                <button 
                    onClick={startNewChat}
                    className="flex items-center gap-2 w-full p-3 bg-zinc-900 text-white rounded-xl mb-4 hover:bg-zinc-800 transition-colors justify-center font-medium text-sm shadow-lg shadow-zinc-200"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </button>
                <div className="flex-1 overflow-y-auto space-y-1">
                    {sessions.map(s => (
                        <button key={s.id} onClick={() => loadSession(s.id)} className="w-full text-left p-2.5 rounded-lg hover:bg-zinc-50 text-sm text-zinc-600 truncate">
                            {s.title || "New Conversation"}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-4xl mx-auto pt-16 pb-4">
          
          {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full px-4 animate-in fade-in zoom-in-95 duration-500">
                  
                  {/* Hero Greeting */}
                  <h1 className="text-3xl md:text-4xl font-semibold mb-8 text-transparent bg-clip-text bg-gradient-to-br from-zinc-800 to-zinc-500 text-center tracking-tight">
                      Hi, {userName}
                  </h1>

                  {/* Input Container */}
                  <div className="w-full max-w-2xl bg-white rounded-3xl border border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-3 transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                      
                      {/* Top Controls */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">
                              <Search className="w-3.5 h-3.5" />
                              Search
                          </button>
                          <button 
                             onClick={() => setIsReasoning(!isReasoning)}
                             className={clsx(
                                 "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                 isReasoning 
                                    ? "bg-blue-50 text-blue-600" 
                                    : "text-zinc-500 hover:bg-zinc-100"
                             )}
                          >
                              <Brain className="w-3.5 h-3.5" />
                              Deep Think
                          </button>
                      </div>

                      {/* Text Input */}
                      <div className="relative px-1">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="How can I help you today?"
                            className="w-full bg-transparent border-none text-zinc-800 text-lg placeholder:text-zinc-400 focus:ring-0 resize-none min-h-[60px] max-h-48 py-2"
                            rows={1}
                        />
                        {/* Right Action Button */}
                        <div className="absolute bottom-2 right-0">
                            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                            <button 
                                onClick={() => input.trim() ? handleSubmit() : fileInputRef.current?.click()}
                                className={clsx(
                                    "p-2 rounded-xl transition-all",
                                    input.trim() 
                                        ? "bg-zinc-900 text-white shadow-lg hover:scale-105" 
                                        : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                                )}
                            >
                                {input.trim() ? <ArrowUp className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                            </button>
                        </div>
                      </div>
                  </div>

                  {/* Quick Action Pills */}
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                      {[ 
                          { icon: Presentation, label: "AI Slides" },
                          { icon: Code, label: "Full-Stack" },
                          { icon: Sparkles, label: "Magic Design" },
                          { icon: PenTool, label: "Write Code" },
                          { icon: Globe, label: "Deep Research" },
                      ].map((item, i) => (
                          <button 
                             key={i}
                             onClick={() => handleSubmit(`Help me with ${item.label}`)}
                             className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-full text-sm text-zinc-600 hover:border-zinc-300 hover:shadow-sm hover:bg-zinc-50 transition-all"
                          >
                              <item.icon className="w-4 h-4 text-zinc-400" />
                              {item.label}
                          </button>
                      ))}
                  </div>

              </div>
          ) : (
              /* Chat View */
              <div className="flex-1 w-full flex flex-col relative overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4 space-y-8" ref={scrollRef}>
                      {messages.map((msg, idx) => (
                          <div key={idx} className={clsx("flex gap-4 max-w-3xl mx-auto w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0 mt-1">
                                        <Brain className="w-4 h-4 text-blue-600" />
                                    </div>
                                )}
                                <div className={clsx(
                                    "px-5 py-3.5 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm",
                                    msg.role === "user" 
                                        ? "bg-zinc-100 text-zinc-800 rounded-br-sm" 
                                        : "bg-white border border-zinc-100 text-zinc-800"
                                )}>
                                    <ReactMarkdown 
                                        components={{
                                            code: ({node, ...props}) => <code className="bg-zinc-100 text-pink-600 px-1 rounded" {...props} />
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                          </div>
                      ))}
                      {isLoading && (
                          <div className="flex gap-4 max-w-3xl mx-auto w-full">
                               <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0 mt-1">
                                    <Brain className="w-4 h-4 text-blue-600 animate-pulse" />
                               </div>
                               <div className="flex items-center gap-1.5 h-8">
                                   <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                   <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                   <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                               </div>
                          </div>
                      )}
                  </div>

                  {/* Floating Input (Chat Mode) */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
                      <div className="max-w-3xl mx-auto w-full bg-white rounded-3xl border border-zinc-200 shadow-xl shadow-black/5 p-2 flex items-end gap-2">
                           <button onClick={() => fileInputRef.current?.click()} className="p-3 hover:bg-zinc-100 rounded-full text-zinc-500">
                               <Paperclip className="w-5 h-5" />
                           </button>
                           <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent border-none text-zinc-800 max-h-32 py-3 focus:ring-0 resize-none"
                                rows={1}
                           />
                           <button 
                                onClick={() => handleSubmit()}
                                className={clsx(
                                    "p-3 rounded-full transition-all",
                                    input.trim() ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                                )}
                           >
                               <ArrowUp className="w-5 h-5" />
                           </button>
                      </div>
                  </div>
              </div>
          )}

      </main>
    </div>
  );
}