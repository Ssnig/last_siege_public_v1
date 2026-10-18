import React, { useEffect, useRef, useState } from 'react';
import { TOWER_TYPES } from '@root/shared';
import { useSmoothCountdown } from './useSmoothCountdown';

interface GameHUDProps {
  gold: number;
  deck: string[];
  selectedTowerType?: string;
  onSelectTower: (towerId: string) => void;
  onOpenMenu: () => void;
  onStartBattle?: () => void;
  phase?: string;
  phaseEndsAt?: number;
  role?: 'attacker' | 'defender';
  isUIHidden?: boolean;
  castleHp?: number;
  maxCastleHp?: number;
  incomeRate?: number;
  /** Attacker-only: toggles the army-staging overlay. Omit to hide the button. */
  onToggleArmy?: () => void;
  /** Whether the army-staging overlay is currently open (drives the button icon). */
  armyOpen?: boolean;
}

const DEFAULT_DEFENDER_TOWERS = [
  'basic',
  'pitchfork',
  'poison',
  'crossbow',
  'cannon',
  'sniper',
];

const TOWER_SHORT_NAMES: Record<string, string> = {
  basic: 'Twr',
  pitchfork: 'Pfk',
  poison: 'Psn',
  crossbow: 'Xbw',
  cannon: 'Can',
  sniper: 'Snp',
};

const TOWER_ICONS: Record<string, string> = {
  basic: '/assets/ui/hud/slot_arrow.png',
  pitchfork: '/assets/ui/hud/slot_pitchfork.png',
  poison: '/assets/ui/hud/slot_poison.png',
  crossbow: '/assets/ui/hud/slot_crossbow.png',
  cannon: '/assets/ui/hud/slot_cannon.png',
  sniper: '/assets/ui/hud/slot_sniper.png',
};

export const GameHUD: React.FC<GameHUDProps> = ({
  gold,
  deck,
  selectedTowerType = 'basic',
  onSelectTower,
  onOpenMenu,
  onStartBattle,
  phase = 'building',
  phaseEndsAt = 30,
  role = 'defender',
  isUIHidden = false,
  castleHp = 45,
  maxCastleHp = 45,
  incomeRate,
  onToggleArmy,
  armyOpen = false,
}) => {
  // Smooth countdown driven by the server's phaseEndsAt (see hook docs).
  const secondsRemaining = useSmoothCountdown(phaseEndsAt, phase !== 'gameover');

  // Brief toast notification on UI toggle
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show a quick toast tip when UI visibility flips (skip on initial mount)
  const isFirstRender = useRef(true);
  // Show a quick toast tip when UI visibility flips
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setToastMessage(isUIHidden ? 'UI Hidden (Double-tap map to show)' : 'UI Visible');
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isUIHidden]);

  // Format MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Towers in tray: strictly top 6 slots (or deck if provided)
  const availableTowers = (deck && deck.length > 0 ? deck : DEFAULT_DEFENDER_TOWERS).slice(0, 6);

  return (
    <>
      {/* Toast notification indicator for Double-Tap UI toggle */}
      {toastMessage && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-amber-500/50 shadow-2xl text-[11px] md:text-xs font-bold text-amber-200 backdrop-blur-sm transition-opacity duration-300">
          {toastMessage}
        </div>
      )}

      {/* Main Game HUD Container with smooth 0.3s ease transition */}
      <aside
        aria-label="Game HUD"
        className={`pointer-events-none fixed inset-0 z-40 select-none overflow-hidden font-['Almendra',serif] transition-opacity duration-300 ${
          isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Top Header Row: Gold (Left), Centered Wave/Timer, Settings + Castle HP (Right) */}
        <div className="w-full flex items-start justify-between px-2.5 sm:px-4 md:px-6 pt-2 pointer-events-none">
          
          {/* Top-Left: Gold display + (attacker) army-panel toggle */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <div
              className="pointer-events-auto relative w-[112px] h-[34px] md:w-[156px] md:h-[44px] flex items-center justify-end pr-2 md:pr-3 shadow-lg drop-shadow transition-transform hover:scale-102"
              style={{
                backgroundImage: "url('/assets/ui/hud/hud_gold_badge_clean.png')",
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className="flex flex-col items-end justify-center leading-none">
                <span className="text-amber-200 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-xs md:text-[15px] tracking-wide font-['Almendra',serif]">
                  GOLD: {gold}g
                </span>
                {incomeRate !== undefined && (
                  <span className="text-emerald-300 font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] text-[10px] md:text-xs tracking-tight font-sans">
                    +{incomeRate}g/s
                  </span>
                )}
              </div>
            </div>

            {onToggleArmy && (
              <button
                onClick={onToggleArmy}
                aria-label={armyOpen ? 'Close army panel' : 'Open army panel'}
                className={`pointer-events-auto flex items-center gap-1 px-2 h-[34px] md:h-[44px] rounded-lg border text-[11px] md:text-sm font-black uppercase tracking-wide shadow-lg active:scale-95 transition font-['Almendra',serif] ${
                  armyOpen
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-slate-950/85 text-amber-200 border-amber-600/60 hover:bg-slate-800'
                }`}
              >
                <span>⚔️</span>
                <span>Army</span>
              </button>
            )}
          </div>

          {/* Top-Center: Exactly Centered Wave & Timer Banner with Pixel-Perfect Plaque Alignment */}
          <div
            className="pointer-events-auto fixed top-1.5 md:top-3 left-1/2 -translate-x-1/2 w-24 h-[60px] md:w-36 md:h-[88px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.9)] transition-transform select-none"
            style={{
              backgroundImage: "url('/assets/ui/hud/hud_wave_banner.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* Phase tag — replaces the old full-text swap so the clock stays visible */}
            {phase === 'combat' && (
              <div className="absolute top-[6%] inset-x-0 flex items-center justify-center pointer-events-none">
                <span className="font-['Almendra',serif] font-black text-red-300 text-[10px] md:text-xs tracking-[0.2em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                  ⚔ COMBAT
                </span>
              </div>
            )}

            {/* Live Numeric Countdown Clock — Exactly aligned in the lower golden plaque */}
            <div className="absolute top-[70%] h-[22%] inset-x-0 flex items-center justify-center pointer-events-none">
               <span className="font-['Almendra',serif] font-bold text-amber-100 text-xs md:text-[15px] tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                 {timeFormatted}
               </span>
            </div>
          </div>

          {/* Top-Right: Settings Medallion + Dynamic Castle HP Indicator */}
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            <button
              onClick={onOpenMenu}
              aria-label="Open Game Settings"
              className="w-7 h-7 md:w-9 md:h-9 rounded-full active:scale-95 hover:scale-105 transition shadow-lg drop-shadow cursor-pointer flex items-center justify-center p-0 border-0 bg-transparent"
            >
              <img
                src="/assets/ui/hud/hud_settings_btn.png"
                alt="Settings"
                className="w-full h-full object-contain"
              />
            </button>

            {/* Compact Base Castle HP Badge */}
             <div className="flex items-center gap-1.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md bg-slate-950/85 border border-amber-600/50 shadow-md text-[11px] md:text-sm text-amber-100 font-bold">
              <span>🏰</span>
              <span>{castleHp}/{maxCastleHp}</span>
              <div className="w-9 h-1.5 md:w-14 md:h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (castleHp / maxCastleHp) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-Center: Defender Building Hotbar (Horizontal Scrollable, Responsive) */}
        {role === 'defender' && (
          <div className="pointer-events-auto fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center max-w-[96vw]">
            <div
              className="relative flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg shadow-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)] bg-gradient-to-r from-red-950/95 via-[#450a0a]/95 to-red-950/95 border border-amber-600/80 overflow-x-auto scrollbar-none touch-pan-x"
              style={{
                boxShadow: '0 0 14px rgba(0,0,0,0.85), inset 0 0 8px rgba(251,191,36,0.3)',
              }}
            >
              {availableTowers.map((towerId) => {
                const tower = TOWER_TYPES[towerId];
                const cost = tower?.tiers[0]?.cost ?? 0;
                const isSelected = selectedTowerType === towerId;
                const canAfford = gold >= cost;
                const iconSrc = TOWER_ICONS[towerId] || '/assets/ui/hud/slot_arrow.png';
                const shortName = TOWER_SHORT_NAMES[towerId] || tower?.name?.slice(0, 3) || towerId.slice(0, 3);

                return (
                  <button
                    key={towerId}
                    onClick={() => onSelectTower(towerId)}
                    className={`relative flex-shrink-0 w-[38px] h-[40px] md:w-[50px] md:h-[54px] flex flex-col items-center justify-between p-0.5 rounded transition-all cursor-pointer ${
                      isSelected ? 'scale-105 z-10' : 'hover:scale-102 opacity-95'
                    } ${!canAfford ? 'opacity-55 saturate-50' : ''}`}
                    title={`${tower?.name ?? towerId} (${cost}g)`}
                  >
                    {/* Tower Icon */}
                    <div className="w-5 h-5 md:w-7 md:h-7 flex items-center justify-center overflow-hidden rounded">
                      <img
                        src={iconSrc}
                        alt={tower?.name ?? towerId}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Golden Glowing Selection Halo */}
                    {isSelected && (
                      <div
                        className="absolute -inset-1 pointer-events-none rounded border-2 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9),inset_0_0_6px_rgba(251,191,36,0.5)] animate-pulse"
                        style={{
                          backgroundImage: "url('/assets/ui/hud/slot_active_halo.png')",
                          backgroundSize: '100% 100%',
                        }}
                      />
                    )}

                    {/* Stacked Title & Cost (e.g. "Twr / 50g") */}
                    <div className="w-full text-center bg-black/75 rounded-b py-[1px] px-0.5">
                       <span className="text-[8px] md:text-[10px] font-bold text-amber-200 leading-none truncate block">
                         {shortName} / {cost}g
                       </span>
                    </div>

                    {/* Insufficient gold indicator */}
                    {!canAfford && (
                      <div className="absolute inset-0 bg-red-950/60 rounded flex items-center justify-center pointer-events-none">
                         <span className="text-[8px] md:text-[10px] text-red-300 font-black drop-shadow">
                           LOW
                         </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom-Right: Start Battle Button for Defender during Building Phase */}
        {phase === 'building' && role === 'defender' && onStartBattle && (
          <button
            onClick={onStartBattle}
            aria-label="Start Battle"
             className="pointer-events-auto fixed bottom-2.5 right-2.5 md:bottom-4 md:right-4 z-40 px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] border-2 border-amber-300 flex items-center gap-1.5 transition-all cursor-pointer font-['Almendra',serif]"
          >
            <span className="text-xs md:text-sm">⚔️</span>
            <span>Start Battle</span>
          </button>
        )}
      </aside>
    </>
  );
};
