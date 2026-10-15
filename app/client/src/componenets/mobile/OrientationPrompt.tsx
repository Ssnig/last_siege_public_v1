import React, { useState, useEffect } from 'react';

/**
 * Mobile device orientation prompt.
 * Detects portrait mode on touch/mobile devices and advises rotating to landscape
 * for the 16:9 canvas game, while providing a one-click Fullscreen toggle.
 */
export const OrientationPrompt: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth && window.innerWidth < 1024;
  });
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 1024;
      setIsPortrait(portrait);
      // If user rotated back to landscape, re-arm the prompt for next time
      if (!portrait) {
        setDismissed(false);
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      // Try to lock screen orientation to landscape if supported
      if ('orientation' in screen && 'lock' in (screen.orientation as any)) {
        await (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore if browser prohibits orientation lock or fullscreen
    }
  };

  if (!isPortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 select-none animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 p-6 flex flex-col items-center text-center shadow-[0_0_40px_rgba(245,158,11,0.25)]">
        {/* Animated Phone Rotate Icon */}
        <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping opacity-30" />
          <svg
            className="w-14 h-14 text-amber-400 animate-bounce"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="2" width="16" height="20" rx="3" />
            <path d="M12 18h.01" />
            <path d="M19 12l3-3-3-3" />
            <path d="M22 9h-5" />
          </svg>
        </div>

        <h3
          className="text-xl font-bold text-amber-200 tracking-wide mb-2"
          style={{ fontFamily: "'MedievalSharp', serif" }}
        >
          Rotate Your Device
        </h3>

        <p
          className="text-xs text-amber-100/70 mb-6 leading-relaxed"
          style={{ fontFamily: "'Almendra', serif" }}
        >
          Versus TD is designed for 16:9 Landscape view. Please rotate your phone sideways for the best battlefield experience.
        </p>

        <div className="flex flex-col w-full gap-2.5">
          <button
            onClick={handleFullscreen}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wider uppercase text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-md hover:brightness-110 active:scale-95 transition"
            style={{ fontFamily: "'Almendra SC', serif" }}
          >
            Enter Fullscreen & Rotate
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="w-full py-2 text-[11px] text-slate-400 hover:text-white transition"
          >
            Continue in portrait anyway
          </button>
        </div>
      </div>
    </div>
  );
};
