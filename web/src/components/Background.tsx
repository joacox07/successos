import { useReducedMotion } from 'framer-motion';

export function Background() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      {/* Base dark */}
      <div className="fixed inset-0 bg-bg-primary transition-colors duration-300 pointer-events-none -z-[30]" />

      {/* Subtle radial vignette - controlled via CSS for theme support */}
      <div className="fixed inset-0 pointer-events-none -z-[28] theme-vignette" />

      {/* Ambient accent orbs — CSS only, no JS animation overhead */}
      {!shouldReduceMotion && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-[20] opacity-40">
          <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-accent-mint/[0.06] blur-[100px]" />
          <div className="absolute top-1/3 -right-48 w-[400px] h-[400px] rounded-full bg-text-primary/[0.025] blur-[90px]" />
          <div className="absolute -bottom-48 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-mint/[0.04] blur-[120px]" />
        </div>
      )}

      {/* Micro dot grid */}
      <div className="fixed inset-0 pointer-events-none -z-[15] overflow-hidden text-text-primary">
        <svg className="w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />
        </svg>
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay" />
    </>
  );
}
