"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { 
  Menu, ChevronDown, User, Search, Brain, 
  Paperclip, Code, Sparkles, Globe, PenTool, 
  Presentation, LayoutGrid, Plus, ArrowUp, X,
  LogOut, Settings, Check
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
  
  // Feature Toggles
  const [isReasoning, setIsReasoning] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  
  // UI States
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  
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
                setUserEmail(user.email || "");
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

  const handleLogout = async () => {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
  };

  useEffect(() => {
    if (!isCheckingAuth) loadSessions();
  }, [loadSessions, isCheckingAuth]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading]);

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

  const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && files.length === 0) || isLoading) return;

    let fullContent = textToSend;
    if (files.length > 0) {
        fullContent += "\n\n" + files.map(f => `--- File: ${f.name} ---\n${f.content}\n--- End File ---`).join("\n\n");
    }

    if (isWebSearch) {
        fullContent = "[WEB SEARCH MODE] " + fullContent;
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
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md transition-all duration-300">
         <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-all duration-200 active:scale-95 text-zinc-600"
             >
                 <Menu className="w-5 h-5" />
             </button>
             
             {/* Model Dropdown */}
             <div className="relative">
                 <button 
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-100 rounded-lg transition-all duration-200 active:scale-95 font-medium text-zinc-800 text-sm"
                 >
                     <span>Neural-4</span>
                     <ChevronDown className={clsx("w-4 h-4 text-zinc-400 transition-transform duration-300", isModelMenuOpen && "rotate-180")} />
                 </button>
                 
                 {isModelMenuOpen && (
                     <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-zinc-100 p-1.5 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                         <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Models</div>
                         <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-50 text-sm font-medium text-zinc-900">
                             <span>Neural-4</span>
                             <Check className="w-4 h-4 text-blue-600" />
                         </button>
                         <button disabled className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-zinc-400 cursor-not-allowed opacity-60">
                             <span>GPT-4o (Coming Soon)</span>
                         </button>
                     </div>
                 )}
                 {isModelMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsModelMenuOpen(false)} />} 
             </div>
         </div>

         {/* User Dropdown */}
         <div className="relative">
            <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-100 to-zinc-200 flex items-center justify-center border border-zinc-200 overflow-hidden hover:shadow-md transition-all duration-300 active:scale-95"
            >
                <User className="w-5 h-5 text-zinc-600" />
            </button>

            {isUserMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-100 p-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                     <div className="px-3 py-3 border-b border-zinc-50 mb-1">
                         <div className="text-sm font-medium text-zinc-900">{userName}</div>
                         <div className="text-xs text-zinc-500 truncate">{userEmail}</div>
                     </div>
                     <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                         <Settings className="w-4 h-4" />
                         Settings
                     </button>
                     <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
                         <LogOut className="w-4 h-4" />
                         Log out
                     </button>
                </div>
            )}
            {isUserMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />} 
         </div>
      </header>

      {/* --- Sidebar (Slide-over) --- */}
      <div className={clsx(
          "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity duration-300",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsSidebarOpen(false)}>
            <div className={clsx(
                "absolute inset-y-0 left-0 w-72 bg-white shadow-2xl p-4 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-8 px-2 pt-2">
                    <h2 className="font-semibold text-zinc-800 tracking-tight text-lg">Your Chats</h2>
                    <button onClick={() => router.push('/forecast')} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors" title="Dashboard">
                         <LayoutGrid className="w-5 h-5" />
                    </button>
                </div>
                
                <button 
                    onClick={startNewChat}
                    className="group flex items-center gap-3 w-full p-3.5 bg-zinc-900 text-white rounded-xl mb-6 hover:bg-zinc-800 hover:shadow-lg hover:shadow-zinc-200 transition-all duration-300 justify-center font-medium text-sm active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                    Start New Chat
                </button>
                
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar -mx-2 px-2">
                    {sessions.length === 0 && <div className="text-sm text-zinc-400 text-center py-10">No history yet</div>}
                    {sessions.map(s => (
                        <button 
                            key={s.id} 
                            onClick={() => loadSession(s.id)} 
                            className={clsx(
                                "w-full text-left p-3 rounded-lg text-sm truncate transition-all duration-200",
                                sessionId === s.id ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-zinc-50"
                            )}
                        >
                            {s.title || "New Conversation"}
                        </button>
                    ))}
                </div>
            </div>
      </div>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-4xl mx-auto pt-20 pb-4">
          
          {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full px-4 animate-in fade-in zoom-in-[0.98] duration-700 ease-out">
                  
                  {/* Hero Greeting */}
                  <h1 className="text-4xl md:text-5xl font-bold mb-10 text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-500 text-center tracking-tight animate-in slide-in-from-bottom-4 duration-700">
                      Hi, {userName}
                  </h1>

                  {/* Input Container */}
                  <div className="w-full max-w-2xl bg-white rounded-[2rem] border border-zinc-200 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] p-4 transition-all duration-300 focus-within:ring-4 focus-within:ring-zinc-100 focus-within:border-zinc-300 group hover:shadow-[0_12px_50px_-12px_rgba(0,0,0,0.12)]">
                      
                      {/* Top Controls */}
                      <div className="flex items-center gap-2 mb-3 px-1">
                          <button 
                             onClick={() => setIsWebSearch(!isWebSearch)}
                             className={clsx(
                                 "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300",
                                 isWebSearch
                                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100" 
                                    : "text-zinc-500 hover:bg-zinc-100"
                             )}
                          >
                              <Search className="w-3.5 h-3.5" />
                              Search
                              {isWebSearch && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                          </button>
                          
                          <button 
                             onClick={() => setIsReasoning(!isReasoning)}
                             className={clsx(
                                 "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300",
                                 isReasoning 
                                    ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100" 
                                    : "text-zinc-500 hover:bg-zinc-100"
                             )}
                          >
                              <Brain className="w-3.5 h-3.5" />
                              Deep Think
                              {isReasoning && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>}
                          </button>
                      </div>

                      {/* File Previews */}
                      {files.length > 0 && (
                          <div className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar">
                              {files.map((f, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-xs text-zinc-700 shrink-0 animate-in zoom-in-95 duration-200">
                                      <div className="bg-white p-1 rounded-md shadow-sm">
                                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                                      </div>
                                      <span className="truncate max-w-[120px] font-medium">{f.name}</span>
                                      <button onClick={() => removeFile(i)} className="hover:bg-zinc-200 p-0.5 rounded-full transition-colors text-zinc-400 hover:text-red-500">
                                          <X className="w-3 h-3" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* Text Input */}
                      <div className="relative px-1">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isReasoning ? "Ask complex questions..." : "How can I help you today?"}
                            className="w-full bg-transparent border-none text-zinc-800 text-lg placeholder:text-zinc-300 focus:ring-0 resize-none min-h-[60px] max-h-48 py-2 pr-12 font-light"
                            rows={1}
                        />
                        {/* Right Action Button */}
                        <div className="absolute bottom-1 right-0">
                            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                            <button 
                                onClick={() => input.trim() ? handleSubmit() : fileInputRef.current?.click()}
                                className={clsx(
                                    "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center",
                                    input.trim() 
                                        ? "bg-zinc-900 text-white shadow-lg hover:scale-110 active:scale-95" 
                                        : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                                )}
                            >
                                {input.trim() ? <ArrowUp className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                            </button>
                        </div>
                      </div>
                  </div>

                  {/* Quick Action Pills */}
                  <div className="mt-8 flex flex-wrap justify-center gap-3 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
                      {[ 
                          { icon: Presentation, label: "AI Slides", prompt: "Create an outline for a presentation about..." },
                          { icon: Code, label: "Full-Stack", prompt: "Help me scaffold a Next.js application..." },
                          { icon: Sparkles, label: "Magic Design", prompt: "Suggest a color palette and layout for..." },
                          { icon: PenTool, label: "Write Code", prompt: "Write a Python script to..." },
                          { icon: Globe, label: "Deep Research", prompt: "Research the latest trends in..." },
                      ].map((item, i) => (
                          <button 
                             key={i}
                             onClick={() => {
                                 setInput(item.prompt);
                                 textareaRef.current?.focus();
                             }}
                             className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 rounded-full text-sm text-zinc-600 hover:border-zinc-300 hover:shadow-md hover:shadow-zinc-100 hover:-translate-y-0.5 transition-all duration-300"
                          >
                              <item.icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 transition-colors" />
                              <span className="font-medium">{item.label}</span>
                          </button>
                      ))}
                  </div>

              </div>
          ) : (
              /* Chat View */
              <div className="flex-1 w-full flex flex-col relative overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-4 pb-36 pt-8 space-y-8 scroll-smooth" ref={scrollRef}>
                      {messages.map((msg, idx) => (
                          <div key={idx} className={clsx("flex gap-5 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500", msg.role === "user" ? "justify-end" : "justify-start")}>
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-blue-200">
                                        <Brain className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div className={clsx(
                                    "px-6 py-4 rounded-[1.5rem] max-w-[85%] text-[15px] leading-7 shadow-sm transition-all hover:shadow-md",
                                    msg.role === "user" 
                                        ? "bg-zinc-100 text-zinc-800 rounded-br-none" 
                                        : "bg-white border border-zinc-100 text-zinc-800 rounded-bl-none"
                                )}>
                                    <ReactMarkdown 
                                        components={{
                                            code: ({node, ...props}) => <code className="bg-zinc-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono border border-zinc-200" {...props} />
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                          </div>
                      ))}
                      {isLoading && (
                          <div className="flex gap-5 max-w-3xl mx-auto w-full animate-in fade-in duration-300">
                               <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-blue-200">
                                    <Brain className="w-4 h-4 text-white animate-pulse" />
                               </div>
                               <div className="flex items-center gap-1.5 h-8 bg-white border border-zinc-100 px-4 rounded-full shadow-sm">
                                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                               </div>
                          </div>
                      )}
                  </div>

                  {/* Floating Input (Chat Mode) */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
                      <div className="max-w-3xl mx-auto w-full bg-white rounded-[2rem] border border-zinc-200 shadow-xl shadow-zinc-200/50 p-2 flex items-end gap-2 transition-all focus-within:ring-2 focus-within:ring-zinc-100">
                           <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                           <button onClick={() => fileInputRef.current?.click()} className="p-3 hover:bg-zinc-100 rounded-full text-zinc-500 transition-colors duration-200 group">
                               <Paperclip className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                           </button>
                           
                           {/* Mini File Preview in Chat Mode */}
                           {files.length > 0 && (
                               <div className="absolute bottom-full left-0 mb-2 bg-white border border-zinc-200 rounded-xl p-2 shadow-lg flex flex-col gap-1">
                                   {files.map((f, i) => (
                                       <div key={i} className="flex items-center gap-2 text-xs text-zinc-600">
                                           <FileText className="w-3 h-3 text-blue-500"/> 
                                           <span className="truncate max-w-[100px]">{f.name}</span>
                                           <button onClick={() => removeFile(i)}><X className="w-3 h-3 hover:text-red-500"/></button>
                                       </div>
                                   ))}
                               </div>
                           )}

                           <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message Neural..."
                                className="flex-1 bg-transparent border-none text-zinc-800 max-h-32 py-3 focus:ring-0 resize-none placeholder:text-zinc-400"
                                rows={1}
                           />
                           <button 
                                onClick={() => handleSubmit()}
                                className={clsx(
                                    "p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95",
                                    input.trim() ? "bg-zinc-900 text-white shadow-md" : "bg-zinc-100 text-zinc-400"
                                )}
                           >
                               <ArrowUp className="w-5 h-5" />
                           </button>
                      </div>
                      <div className="text-center mt-2 text-[10px] text-zinc-400 font-medium">
                          Neural can make mistakes. Check important info.
                      </div>
                  </div>
              </div>
          )}

      </main>
    </div>
  );
}
