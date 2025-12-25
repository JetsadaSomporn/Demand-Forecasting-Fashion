"use client";

import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { Send, Sparkles, User, Bot, StopCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/client";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export default function NeuralPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/neural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setMessages((prev) => [...prev, data]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again or check your connection." 
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
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
    <div className="flex h-[calc(100vh-60px)] flex-col px-4 pt-24 md:px-0">
      {/* Header / Intro */}
      {messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-700">
          <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-xl">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-[0.2em] text-white/90">
              NEURAL
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-white/50">
              Your AI companion for fashion insights, demand forecasting, and creative analysis.
              Powered by Llama 3.3 70B.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-2xl w-full pt-8">
            {[
              "Analyze the latest fashion trends",
              "Forecast demand for summer dresses",
              "Explain the impact of seasonality",
              "Suggest colors for a new collection"
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion);
                  // Optional: auto-submit
                  // handleSubmit();
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-6 pb-4"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={clsx(
                "flex w-full gap-4 max-w-3xl mx-auto",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 ring-1 ring-white/10 mt-1">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
              )}
              
              <div
                className={clsx(
                  "relative max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? "bg-accent text-white rounded-tr-sm"
                    : "bg-white/10 text-white/90 rounded-tl-sm ring-1 ring-white/10"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 mt-1">
                  <User className="h-4 w-4 text-white/70" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex w-full gap-4 max-w-3xl mx-auto">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 ring-1 ring-white/10">
                <Sparkles className="h-4 w-4 text-accent animate-pulse" />
              </div>
              <div className="flex items-center space-x-1 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce"></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="mx-auto w-full max-w-3xl pt-4">
        <div className="relative flex items-end gap-2 rounded-3xl border border-white/20 bg-white/10 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 focus-within:border-white/40 focus-within:bg-white/15 focus-within:ring-white/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Neural anything..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none scrollbar-hide max-h-[200px]"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
              input.trim() 
                ? "bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/25" 
                : "bg-white/10 text-white/30 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <StopCircle className="h-4 w-4 animate-pulse" />
            ) : (
              <Send className="h-4 w-4 ml-0.5" />
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/30 uppercase tracking-widest font-medium">
          Powered by Llama 3.3 70B via NVIDIA
        </p>
      </div>
    </div>
  );
}