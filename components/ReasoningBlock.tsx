"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, CircleDashed, Loader2, Terminal, Brain } from "lucide-react";
import { clsx } from "clsx";

interface ReasoningBlockProps {
  children: React.ReactNode;
}

export default function ReasoningBlock({ children }: ReasoningBlockProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  
  // Convert children to string to analyze content
  const content = String(children);
  
  // Rudimentary check: if the stream seems to have moved past this block (in a real app, parent would control this)
  // For now, we assume if it's rendered, it's "processing" until it stops changing? 
  // Actually, ReactMarkdown renders this *as* it streams.
  // We'll treat it as "Processing" by default.
  
  // Let's try to split lines to look for "steps"
  const lines = content.split('\n').filter(line => line.trim() !== "");

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 font-mono text-sm shadow-xl">
      
      {/* Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50 group"
      >
        <div className="flex items-center gap-2.5">
            <div className={clsx(
                "p-1.5 rounded-md",
                "bg-green-500/10 text-green-400" 
            )}>
                <Terminal className="w-4 h-4" />
            </div>
            <span className={clsx(
                "font-medium tracking-wide text-xs uppercase",
                "text-green-400"
            )}>
                Neural Process
            </span>
            <div className="flex gap-1 items-center">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse [animation-delay:150ms]" />
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500/20 animate-pulse [animation-delay:300ms]" />
            </div>
        </div>
        
        <div className="flex items-center gap-2 text-zinc-500 group-hover:text-zinc-300 transition-colors">
            <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                {lines.length} Steps
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Content */}
      <div 
        className={clsx(
            "transition-all duration-300 ease-in-out overflow-hidden",
            isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-4 space-y-4">
            
            {/* Steps Visualization (Mocked based on lines) */}
            <div className="space-y-2">
                {lines.map((line, idx) => {
                    const isLast = idx === lines.length - 1;
                    // Detect if line looks like a step "1. ...", "- ...", "* ..."
                    const isStep = /^\d+\.|^-|^\*/.test(line.trim());
                    
                    return (
                        <div key={idx} className="flex gap-3 text-zinc-300">
                             <div className="pt-1 shrink-0">
                                 {isLast ? (
                                     <Loader2 className="w-3.5 h-3.5 text-green-400 animate-spin" />
                                 ) : (
                                     <CheckCircle2 className="w-3.5 h-3.5 text-green-500/50" />
                                 )}
                             </div>
                             <div className={clsx(
                                 "leading-relaxed break-words",
                                 isLast ? "text-green-300 font-medium" : "text-zinc-400"
                             )}>
                                 {line.replace(/^(\d+\.|-|^\*)\s*/, '')}
                             </div>
                        </div>
                    );
                })}
            </div>

            {/* Inner Thought Divider */}
            <div className="pt-2 mt-2 border-t border-zinc-800/50">
                 <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-wider mb-2">
                     <Brain className="w-3 h-3" />
                     Inner Monologue
                 </div>
                 <div className="pl-3 border-l-2 border-zinc-800 text-zinc-500 italic text-xs leading-5">
                    {children}
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
}
