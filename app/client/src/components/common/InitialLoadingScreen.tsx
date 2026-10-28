import React, { useState, useEffect } from 'react';
import { AssetPreloader } from '../../game/assetPreloader';

/**
 * Fast-Boot Splash Screen.
 * Displays a brief 700ms royal crest intro on initial site entry,
 * then gracefully reveals the Lobby while battle assets continue
 * streaming in the background.
 */
export const InitialLoadingScreen: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState<boolean>(() => AssetPreloader.isCoreLoaded());
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    // Start background asset downloading immediately
    AssetPreloader.preloadCoreAssets().catch(() => {});

    if (AssetPreloader.isCoreLoaded()) {
      setIsLoaded(true);
      return;
    }

    // Brief premium imperial crest splash (650ms), then smooth fade out
    const splashTimer = setTimeout(() => {
      setIsFadingOut(true);
      const exitTimer = setTimeout(() => {
        setIsLoaded(true);
      }, 350);
      return () => clearTimeout(exitTimer);
    }, 650);

    return () => clearTimeout(splashTimer);
  }, []);

  if (isLoaded) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none transition-opacity duration-350 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#020617' }}
    >
      {/* Ambient Radial Golden Glow */}
      <div className="absolute w-[450px] h-[450px] rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

      {/* Center Royal Crest */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center animate-fadeIn">
        <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600/30 via-yellow-500/20 to-transparent animate-spin-slow" />
          <div className="absolute inset-2 rounded-full border-2 border-amber-400/40" />
          <img
            src="/assets/svg/logo.svg"
            alt="Royal Crest"
            className="w-14 h-14 object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse"
          />
        </div>

        <h1
          className="text-3xl sm:text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 mb-2"
          style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
        >
          LAST SIEGE
        </h1>

        <p
          className="text-xs text-amber-200/60 uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
        >
          Entering Imperial Realm...
        </p>
      </div>
    </div>
  );
};
