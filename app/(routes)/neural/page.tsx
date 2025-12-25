"use client";

import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export default function NeuralPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

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
      const errorMessage: Message = { role: "assistant", content: "Sorry, I encountered an error. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName =
    "w-full rounded-lg border border-white/20 bg-white/12 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white focus:ring-2 focus:ring-white/30 pr-12";

  return (
    <div className="min-h-screen px-6 py-24 text-white">
      <div className="mx-auto max-w-4xl flex flex-col h-[80vh]">
        <header className="mb-6 text-center">
          <h1 className="text-sm font-bold uppercase tracking-[0.35em] text-white/75">
            NEURAL
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Powered by Llama 3 70B
          </p>
        </header>

        <div className="flex-1 overflow-y-auto mb-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl custom-scrollbar" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-white/40 text-sm flex-col gap-2">
              <p>Start a conversation with Neural</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    "max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "self-end bg-white/20 text-white"
                      : "self-start bg-black/40 text-white/90"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {isLoading && (
                <div className="self-start max-w-[85%] rounded-2xl px-5 py-3 text-sm bg-black/40 text-white/90 animate-pulse">
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="relative shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            className={inputClassName}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/60 hover:text-white disabled:opacity-50 transition hover:bg-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
