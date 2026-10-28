import React from 'react';
import { GoldCrest, GoldDivider, RoyalPanel } from '../lobby/LobbyOrnaments';

interface BattlefieldTransitionOverlayProps {
  mapName: string;
  isFading: boolean;
}

/**
 * Royal Battlefield Transition Overlay.
 * Displays when moving from the draft phase into the building phase,
 * providing a smooth transition while the battlefield textures, scenery,
 * and HUD finish loading, and dismissing only when the scene is ready.
 */
export const BattlefieldTransitionOverlay: React.FC<BattlefieldTransitionOverlayProps> = ({
  mapName,
  isFading,
}) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center select-none bg-slate-950/90 backdrop-blur-md transition-opacity duration-500 ease-out ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient texture */}
      <img
        src="/assets/ui/bg2.webp"
        alt="Battlefield Entrance"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80 pointer-events-none" />

      {/* Main Imperial Transition Panel */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="relative">
          <GoldCrest />
        </div>

        <RoyalPanel className="p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl shadow-[0_0_50px_rgba(212,175,55,0.35)]">
          {/* Animated Swords / Pulse Beacon */}
          <div className="relative w-16 h-16 mb-4 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping opacity-60" />
            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/30 border-2 border-amber-400/60 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)]">
              <svg
                className="w-7 h-7 text-amber-300 animate-pulse"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6-6" />
                <path d="M16 16l4 4" />
                <path d="M19 21l2-2" />
              </svg>
            </div>
          </div>

          <h2
            className="text-2xl sm:text-3xl font-black text-amber-100 tracking-wider mb-1"
            style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
          >
            Entering Royal Battlefield
          </h2>

          <p
            className="text-xs sm:text-sm text-amber-300/90 mb-4 font-semibold tracking-wide"
            style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
          >
            {mapName}
          </p>

          <GoldDivider className="mb-4" />

          {/* Status line */}
          <div className="flex items-center gap-2 text-xs font-bold text-amber-200/80 uppercase tracking-widest animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
            <span>Establishing Fortifications & Siege Lines</span>
          </div>
        </RoyalPanel>
      </div>
    </div>
  );
};
