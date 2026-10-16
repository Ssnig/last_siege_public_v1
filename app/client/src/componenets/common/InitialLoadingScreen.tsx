import React, { useState, useEffect } from 'react';

const LORE_TIPS = [
  "The Konbaung defenders command five ancient stone pads to guard the citadel.",
  "Invaders march across two treacherous mountain passes toward the royal palace.",
  "Archer towers strike from afar, picking off fast-moving scout runners.",
  "Fortifying your defenses requires strategic gold management during the build phase.",
  "Cooperate or conquer: every commander chooses between attacking or defending the realm."
];

const PRELOAD_IMAGES = [
  '/assets/ui/bg.jpg',
  '/assets/ui/bg2.jpg',
  '/assets/ui/left_panel_tight.png',
  '/assets/ui/right_panel_tight.png',
  '/assets/ui/play_button_clean.png'
];

/**
 * Initial Game Asset Preloader.
 * Preloads core UI assets and fonts on app startup, displaying an ornate
 * gold progress bar and rotating lore tips before smoothly fading out.
 */
export const InitialLoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState<number>(10);
  const [tipIndex, setTipIndex] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    // Cycle lore tips every 2.4 seconds
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LORE_TIPS.length);
    }, 2400);

    let loadedCount = 0;
    const totalAssets = PRELOAD_IMAGES.length + 1; // +1 for fonts

    const updateProgress = () => {
      loadedCount++;
      const pct = Math.min(100, Math.round((loadedCount / totalAssets) * 100));
      setProgress(pct);

      if (loadedCount >= totalAssets) {
        // Enforce smooth finish with short pause
        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => setIsLoaded(true), 400);
        }, 500);
      }
    };

    // 1. Preload Fonts
    if ('fonts' in document) {
      document.fonts.ready
        .then(() => updateProgress())
        .catch(() => updateProgress());
    } else {
      updateProgress();
    }

    // 2. Preload Key Images
    PRELOAD_IMAGES.forEach((src) => {
      const img = new Image();
      img.onload = () => updateProgress();
      img.onerror = () => updateProgress(); // Don't block if single image fails
      img.src = src;
    });

    // Safety timeout: Never hang on slow networks for more than 4 seconds
    const safetyTimeout = setTimeout(() => {
      setProgress(100);
      setIsFadingOut(true);
      setTimeout(() => setIsLoaded(true), 400);
    }, 4000);

    return () => {
      clearInterval(tipInterval);
      clearTimeout(safetyTimeout);
    };
  }, []);

  if (isLoaded) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none transition-opacity duration-400 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#020617' }}
    >
      {/* Ambient Radial Golden Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Center Ornate Card */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        {/* Animated Imperial Crest Icon */}
        <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600/30 via-yellow-500/20 to-transparent animate-spin-slow" />
          <div className="absolute inset-2 rounded-full border-2 border-amber-400/40" />
          <svg
            className="w-12 h-12 text-amber-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L4 7v6c0 5.25 3.5 10.15 8 11.25 4.5-1.1 8-6 8-11.25V7l-8-5z" />
            <path d="M12 22V12" />
            <path d="M12 12l4-2.5" />
            <path d="M12 12l-4-2.5" />
          </svg>
        </div>

        {/* Title & Subtitle */}
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200"
          style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
        >
          VERSUS TD
        </h1>
        <p
          className="text-xs uppercase tracking-[0.3em] text-amber-400/70 mt-1 mb-8"
          style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
        >
          Konbaung Dynasty
        </p>

        {/* Ornate Gold Progress Bar */}
        <div className="w-full relative mb-3">
          {/* Progress Bar Track */}
          <div
            className="w-full h-3 rounded-full overflow-hidden p-0.5"
            style={{
              background: 'linear-gradient(180deg, #1e1b18, #0f0d0b)',
              border: '1.5px solid #c59b27',
              boxShadow: '0 0 12px rgba(197,155,39,0.3), inset 0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            {/* Progress Bar Fill */}
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #d97706, #fbbf24, #10b981)',
                boxShadow: '0 0 10px rgba(251,191,36,0.7)',
              }}
            />
          </div>

          {/* Gold Progress Percentage */}
          <div className="flex justify-between items-center text-[11px] text-amber-200/80 font-mono mt-2 font-bold">
            <span style={{ fontFamily: "'Almendra', serif" }}>Preparing Battlefield...</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Dynamic Rotating Lore Tip */}
        <div className="h-12 flex items-center justify-center mt-2">
          <p
            key={tipIndex}
            className="text-xs text-slate-400 italic leading-relaxed animate-fadeIn"
            style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
          >
            "{LORE_TIPS[tipIndex]}"
          </p>
        </div>
      </div>
    </div>
  );
};
