import React, { useState, useEffect } from 'react';
import { soundEffects } from '../../audio/soundEffects';

/**
 * Mobile Fullscreen Gate.
 * Mobile browsers (iOS Safari, Android Chrome) display a search/address bar on top
 * until the user interacts with the page to enter fullscreen.
 * This gate prompts a single tap to request fullscreen, lock landscape, and enable audio.
 */
export const MobileFullscreenGate: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Detect mobile touch screen
    const checkMobile = () => {
      const mobile =
        ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
        window.innerWidth <= 1024;
      setIsMobile(mobile);
    };

    checkMobile();

    const handleFullscreenChange = () => {
      const fs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(fs);
      if (fs) {
        setDismissed(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const triggerFullscreen = async () => {
    soundEffects.playClick();

    // 1. Enter Fullscreen (Hides mobile browser search bar)
    const elem = document.documentElement as any;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch {
      // In case browser policy restricts fullscreen
    }

    // 2. Lock Screen Orientation to Landscape
    try {
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {}

    // 3. Scroll to hide iOS Safari bar
    window.scrollTo(0, 1);

    setDismissed(true);
  };

  // If not mobile, or already fullscreen, or dismissed, do not render
  if (!isMobile || isFullscreen || dismissed) {
    return null;
  }

  return (
    <div
      onClick={triggerFullscreen}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 select-none cursor-pointer animate-fadeIn"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/70 p-6 flex flex-col items-center text-center shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-modalPop">
        {/* Ornate Gold Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 rounded-full mb-5" />

        {/* Fullscreen Expand Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
          <svg
            className="w-8 h-8 text-amber-400 animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </div>

        <h2
          className="text-2xl font-bold text-amber-100 tracking-wide mb-1"
          style={{ fontFamily: "'MedievalSharp', serif" }}
        >
          Versus TD
        </h2>

        <p
          className="text-xs text-amber-200/70 mb-5 leading-relaxed"
          style={{ fontFamily: "'Almendra', serif" }}
        >
          Tap below to enter Fullscreen mode and hide the browser search bar.
        </p>

        {/* Enter Fullscreen Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerFullscreen();
          }}
          className="w-full py-3 px-5 rounded-xl font-bold text-sm tracking-widest uppercase text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-95 transition cursor-pointer"
          style={{ fontFamily: "'Almendra SC', serif" }}
        >
          ⛶ Enter Fullscreen
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="mt-3 text-[11px] text-slate-400 hover:text-slate-200 transition underline underline-offset-2"
        >
          Continue without fullscreen
        </button>
      </div>
    </div>
  );
};
