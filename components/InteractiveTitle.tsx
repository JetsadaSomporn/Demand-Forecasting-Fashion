'use client';

import { useState } from 'react';

export default function InteractiveTitle({ title }: { title: string }) {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPos = event.clientX - bounds.left;
    const yPos = event.clientY - bounds.top;
    setCursorPosition({ x: xPos, y: yPos });
    
    const newRipple = { x: xPos, y: yPos, id: Date.now() };
    setRipples((prev) => [...prev.slice(-5), newRipple]);
    
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 2000);
  };

  return (
    <div
      className="relative inline-block cursor-default"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
    >
      <h1 className="relative font-display text-[clamp(4.5rem,13vw,11rem)] uppercase tracking-[0.08em] text-white drop-shadow-[0_40px_80px_rgba(0,0,0,0.45)] select-none">
        {title}
      </h1>
      
      {/* Blur effect ตรงเมาส์ */}
      {isActive && (
        <>
          {/* Layer เบลอ - ใช้ filter blur */}
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              filter: 'blur(8px)',
              maskImage: `radial-gradient(circle 140px at ${cursorPosition.x}px ${cursorPosition.y}px, black 20%, transparent 80%)`,
              WebkitMaskImage: `radial-gradient(circle 140px at ${cursorPosition.x}px ${cursorPosition.y}px, black 20%, transparent 80%)`,
            }}
          >
            <h1 className="font-display text-[clamp(4.5rem,13vw,11rem)] uppercase tracking-[0.08em] text-white drop-shadow-[0_40px_80px_rgba(0,0,0,0.45)]">
              {title}
            </h1>
          </div>
          
          {/* Glow ตรงเมาส์ */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 100px at ${cursorPosition.x}px ${cursorPosition.y}px, rgba(255, 255, 255, 0.15), transparent 70%)`,
            }}
          />
        </>
      )}
      
      {/* Water Ripple Effects - วางไว้ข้างนอก */}
      <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 10 }}>
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="absolute"
            style={{
              left: ripple.x,
              top: ripple.y,
            }}
          >
            {/* คลื่นวงแรก */}
            <div 
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60"
              style={{
                animation: 'ripple 2s ease-out forwards',
              }}
            />
            {/* คลื่นวงสอง */}
            <div 
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
              style={{
                animation: 'ripple 2s ease-out 0.3s forwards',
              }}
            />
            {/* คลื่นวงสาม */}
            <div 
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"
              style={{
                animation: 'ripple 2s ease-out 0.6s forwards',
              }}
            />
            {/* Background glow */}
            <div 
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-md"
              style={{
                animation: 'ripple-glow 2s ease-out forwards',
              }}
            />
          </div>
        ))}
      </div>
      
      <style jsx>{`
        @keyframes ripple {
          0% {
            width: 0px;
            height: 0px;
            opacity: 1;
          }
          100% {
            width: 400px;
            height: 400px;
            opacity: 0;
          }
        }
        
        @keyframes ripple-glow {
          0% {
            width: 0px;
            height: 0px;
            opacity: 0.4;
          }
          50% {
            opacity: 0.2;
          }
          100% {
            width: 400px;
            height: 400px;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
