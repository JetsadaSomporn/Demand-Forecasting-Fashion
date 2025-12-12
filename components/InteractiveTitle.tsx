'use client';

import { useState } from 'react';

'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function InteractiveTitle({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blurLayerRef = useRef<HTMLHeadingElement>(null);
  const xTo = useRef<gsap.QuickToFunc>();
  const yTo = useRef<gsap.QuickToFunc>();

  useGSAP(
    () => {
      // Setup the quickTo functions for high-performance mouse tracking
      // We animate CSS variables --x and --y to control the clip-path
      xTo.current = gsap.quickTo(containerRef.current, '--x', {
        duration: 0.2,
        ease: 'power3.out',
      });
      yTo.current = gsap.quickTo(containerRef.current, '--y', {
        duration: 0.2,
        ease: 'power3.out',
      });

      // Initial Entrance Animation
      const tl = gsap.timeline();
      tl.fromTo(
        '.title-char',
        { y: 100, opacity: 0, filter: 'blur(10px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          stagger: 0.05,
          duration: 1.2,
          ease: 'power4.out',
        }
      );
    },
    { scope: containerRef }
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !xTo.current || !yTo.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    xTo.current(x);
    yTo.current(y);
  };

  const handleMouseLeave = () => {
    // Optional: Reset or fade out effect on leave
    // For now, we leave it where it was for a nice lingering effect
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block cursor-default select-none py-4"
      style={{
        // Initialize variables
        ['--x' as string]: '-100%',
        ['--y' as string]: '-100%',
      }}
    >
      {/* Base Layer - Sharp & Clean */}
      <h1 className="title-char relative z-10 font-display text-[clamp(3.5rem,12vw,11rem)] uppercase tracking-[0.08em] text-[#ffffff] sm:text-[clamp(4rem,11vw,11rem)]">
        {title}
      </h1>

      {/* Effect Layer - Blurred & Glowing */}
      {/* This layer sits on top but is clipped by the circle following the mouse */}
      <h1
        ref={blurLayerRef}
        className="pointer-events-none absolute inset-0 z-20 font-display text-[clamp(3.5rem,12vw,11rem)] uppercase tracking-[0.08em] text-[#ffffff] sm:text-[clamp(4rem,11vw,11rem)]"
        style={{
          filter: 'blur(12px) brightness(1.5)',
          clipPath: 'circle(120px at var(--x) var(--y))',
          willChange: 'clip-path',
        }}
      >
        {title}
      </h1>
      
      {/* Optional: Subtle bloom underlay for more depth */}
       <h1
        className="pointer-events-none absolute inset-0 z-0 font-display text-[clamp(3.5rem,12vw,11rem)] uppercase tracking-[0.08em] text-[#ffffff]/10 sm:text-[clamp(4rem,11vw,11rem)]"
        style={{
          filter: 'blur(40px)',
          transform: 'scale(1.1)',
        }}
      >
        {title}
      </h1>
    </div>
  );
}
