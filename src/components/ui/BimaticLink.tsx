import { useEffect, useRef } from 'react';
import anime from 'animejs';

export const BimaticLink = () => {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Pulsating glow animation
    if (glowRef.current) {
      anime({
        targets: glowRef.current,
        opacity: [0.3, 0.8, 0.3],
        scale: [1, 1.1, 1],
        easing: 'easeInOutSine',
        duration: 2000,
        loop: true,
      });
    }

    // Subtle bounce on text
    if (containerRef.current) {
      const textEl = containerRef.current.querySelector('.bimatic-text');
      if (textEl) {
        anime({
          targets: textEl,
          translateY: [-1, 1, -1],
          easing: 'easeInOutQuad',
          duration: 1500,
          loop: true,
        });
      }
    }
  }, []);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      anime({
        targets: containerRef.current,
        scale: 1.05,
        duration: 200,
        easing: 'easeOutQuad',
      });
    }
  };

  const handleMouseLeave = () => {
    if (containerRef.current) {
      anime({
        targets: containerRef.current,
        scale: 1,
        duration: 200,
        easing: 'easeOutQuad',
      });
    }
  };

  return (
    <a
      ref={containerRef}
      href="https://bimatic.ch"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
    >
      {/* Pulsating glow effect */}
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/30 to-cyan-400/30 blur-md -z-10"
      />

      {/* Text */}
      <span className="bimatic-text text-sm font-semibold text-white drop-shadow-md">
        Mehr von Bimatic
      </span>

      {/* Logo with white filter for visibility */}
      <img
        src="/bimatic-logo.svg"
        alt="Bimatic Logo"
        className="h-7 brightness-0 invert drop-shadow-md"
      />

      {/* Sparkle indicator */}
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
      </span>
    </a>
  );
};
