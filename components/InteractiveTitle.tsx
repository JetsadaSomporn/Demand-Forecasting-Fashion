'use client';

import { useState } from 'react';

export default function InteractiveTitle({ title }: { title: string }) {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPos = event.clientX - bounds.left;
    const yPos = event.clientY - bounds.top;
    setCursorPosition({ x: xPos, y: yPos });
  };

  return (
    <div
      className="relative inline-block cursor-default"
      onMouseMove={handleMove}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
    >
      <h1 className="relative font-display text-[clamp(4.5rem,13vw,11rem)] uppercase tracking-[0.08em] text-white drop-shadow-[0_40px_80px_rgba(0,0,0,0.45)] select-none">
        {title}
      </h1>
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none backdrop-blur-md transition-opacity duration-200"
          style={{
            maskImage: `radial-gradient(circle 150px at ${cursorPosition.x}px ${cursorPosition.y}px, black 0%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(circle 150px at ${cursorPosition.x}px ${cursorPosition.y}px, black 0%, transparent 100%)`,
          }}
        >
          <h1 className="font-display text-[clamp(4.5rem,13vw,11rem)] uppercase tracking-[0.08em] text-white drop-shadow-[0_40px_80px_rgba(0,0,0,0.45)] blur-sm">
            {title}
          </h1>
        </div>
      )}
    </div>
  );
}
