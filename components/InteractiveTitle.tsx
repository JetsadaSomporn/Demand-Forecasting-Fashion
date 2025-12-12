'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

export default function InteractiveTitle({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);
  
  // Physics state
  const mouse = useRef({ x: 0, y: 0, isActive: false });
  const time = useRef(0);

  useEffect(() => {
    // Initialize character refs array
    charsRef.current = charsRef.current.slice(0, title.length);

    // Physics constants
    const FRICTION = 0.08; // Viscosity: Lower = slower/heavier liquid
    const IDLE_AMPLITUDE = 8; // Height of the idle wave
    const IDLE_SPEED = 0.03; // Speed of the idle wave
    const MOUSE_RADIUS = 200; // Radius of influence
    const MOUSE_STRENGTH = 120; // How much the mouse pushes the water
    const BLUR_STRENGTH = 0.25; // How blurry it gets when moving

    // Current state storage (to avoid reading DOM)
    const physics = title.split('').map(() => ({
      y: 0,
      targetY: 0,
      vx: 0
    }));

    const updatePhysics = () => {
      time.current += IDLE_SPEED;

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      charsRef.current.forEach((char, i) => {
        if (!char) return;

        // 1. Calculate Target Y (Where the letter wants to go)
        // ----------------------------------------------------
        
        // A. Idle Ocean Swell (Sine Wave)
        let targetY = Math.sin(time.current + i * 0.4) * IDLE_AMPLITUDE;

        // B. Mouse Interaction (Repulsion/Attraction)
        if (mouse.current.isActive) {
          const charRect = char.getBoundingClientRect();
          const charCenterX = charRect.left + charRect.width / 2;
          const charCenterY = charRect.top + charRect.height / 2;

          // Mouse position relative to viewport
          const mouseX = mouse.current.x;
          const mouseY = mouse.current.y;

          const dx = mouseX - charCenterX;
          const dy = mouseY - charCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_RADIUS) {
            // Calculate influence (0 to 1, Gaussian-ish)
            const influence = Math.pow(1 - dist / MOUSE_RADIUS, 2);
            
            // Push letters DOWN/UP away from mouse Y
            // If mouse is above letter, push down. If below, push up.
            // but for a "wave" feel, we often just want it to rise or fall based on X proximity
            
            // Let's create a "Wake" effect: The mouse drags the water level up/down
            const relativeY = (mouseY - rect.top) - (rect.height / 2);
            targetY += -relativeY * influence * 1.5; // Magnetic vertical pull
          }
        }

        // 2. Physics Simulation (Lerp)
        // ----------------------------------------------------
        const p = physics[i];
        
        // Smoothly interpolate current Y towards target Y
        const diff = targetY - p.y;
        p.y += diff * FRICTION;

        // 3. Render
        // ----------------------------------------------------
        
        // Velocity-based Blur (The "Liquid" Look)
        // We calculate velocity based on the difference we just moved
        const velocity = Math.abs(diff); 
        const blur = Math.min(velocity * BLUR_STRENGTH, 15); // Cap blur at 15px

        // Apply styles directly for performance (bypassing React render cycle)
        char.style.transform = `translate3d(0, ${p.y}px, 0)`;
        
        // Only apply blur if it's significant (optimization)
        if (blur > 0.5) {
          char.style.filter = `blur(${blur}px)`;
          char.style.opacity = `${1 - blur * 0.03}`; // Slight fade on fast movement
        } else {
          char.style.filter = 'none';
          char.style.opacity = '1';
        }
      });
    };

    // Add listener
    gsap.ticker.add(updatePhysics);

    // Cleanup
    return () => {
      gsap.ticker.remove(updatePhysics);
    };
  }, [title]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    mouse.current.x = e.clientX;
    mouse.current.y = e.clientY;
    mouse.current.isActive = true;
  };

  const handleMouseLeave = () => {
    mouse.current.isActive = false;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative inline-flex cursor-default select-none justify-center overflow-visible py-32" // Increased padding for wave height
    >
      <h1 className="font-display text-[clamp(3.5rem,12vw,11rem)] font-bold uppercase tracking-[0.08em] text-[#ffffff] sm:text-[clamp(4rem,11vw,11rem)]">
        {title.split('').map((char, i) => (
          <span
            key={i}
            ref={(el) => {
              charsRef.current[i] = el;
            }}
            className="inline-block will-change-transform"
            style={{ 
              position: 'relative',
              display: 'inline-block',
              minWidth: char === ' ' ? '0.3em' : 'auto' 
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </h1>
    </div>
  );
}
