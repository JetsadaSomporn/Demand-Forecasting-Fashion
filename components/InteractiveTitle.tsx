'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function InteractiveTitle({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);

  // Split title into characters
  const chars = title.split('');

  useGSAP(
    () => {
      // Entrance Animation: Staggered pop-up with elastic settle
      gsap.fromTo(
        charsRef.current,
        { 
          y: 100, 
          opacity: 0,
          scale: 0.5 
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          stagger: 0.04,
          duration: 1.5,
          ease: 'elastic.out(1, 0.5)',
          delay: 0.2,
        }
      );
    },
    { scope: containerRef }
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // Mouse X relative to container

    // Animate each character based on distance from mouse
    charsRef.current.forEach((char, index) => {
      if (!char) return;

      const charRect = char.getBoundingClientRect();
      const charCenter = charRect.left + charRect.width / 2 - rect.left;
      
      // Calculate distance (absolute value)
      const dist = Math.abs(mouseX - charCenter);
      
      // Configuration for the wave effect
      const hoverRadius = 250; // How wide the wave is
      const maxDisplacement = -60; // How high the letters jump (negative is up)
      const maxScale = 1.35; // How big they get
      const maxRotate = 15; // Rotation spread

      if (dist < hoverRadius) {
        // Calculate intensity (0 to 1) based on distance (Gaussian-ish falloff)
        const intensity = 1 - Math.pow(dist / hoverRadius, 2);
        
        const y = maxDisplacement * intensity;
        const scale = 1 + (maxScale - 1) * intensity;
        
        // Rotate slightly away from center of wave
        const rotate = (charCenter < mouseX ? -1 : 1) * maxRotate * intensity;

        gsap.to(char, {
          y: y,
          scale: scale,
          rotate: rotate,
          color: '#ffffff', // Keep white, or optional subtle tint
          textShadow: `0 0 ${20 * intensity}px rgba(255,255,255,0.8)`, // Bloom effect
          duration: 0.1, // Super fast response
          overwrite: 'auto',
          ease: 'power2.out',
        });
      } else {
        // Return to neutral if outside radius
        gsap.to(char, {
          y: 0,
          scale: 1,
          rotate: 0,
          textShadow: '0 0 0px rgba(255,255,255,0)',
          duration: 0.8, // Slower settle
          overwrite: 'auto',
          ease: 'elastic.out(1, 0.3)', // Bouncy elastic return
        });
      }
    });
  };

  const handleMouseLeave = () => {
    // Reset all characters with a satisfying elastic wobble
    if (!charsRef.current) return;
    
    gsap.to(charsRef.current, {
      y: 0,
      scale: 1,
      rotate: 0,
      textShadow: '0 0 0px rgba(255,255,255,0)',
      duration: 1.2,
      ease: 'elastic.out(1, 0.3)',
      stagger: {
        amount: 0.1,
        from: 'center'
      }
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative inline-flex cursor-default select-none justify-center overflow-visible py-20"
    >
      <h1 className="font-display text-[clamp(3.5rem,12vw,11rem)] font-bold uppercase tracking-[0.08em] text-[#ffffff] sm:text-[clamp(4rem,11vw,11rem)]">
        {chars.map((char, i) => (
          <span
            key={i}
            ref={(el) => {
              charsRef.current[i] = el;
            }}
            className="inline-block origin-bottom will-change-transform"
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
