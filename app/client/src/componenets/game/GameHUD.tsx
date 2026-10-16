import React, { useEffect, useState } from 'react';
import { TOWER_TYPES } from '@root/shared';

interface GameHUDProps {
  gold: number;
  deck: string[];
  selectedTowerType?: string;
  onSelectTower: (towerId: string) => void;
  onOpenMenu: () => void;
  phase?: string;
  phaseEndsAt?: number;
  role?: 'attacker' | 'defender';
  isUIHidden?: boolean;
  castleHp?: number;
  maxCastleHp?: number;
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
  phase = 'building',
  phaseEndsAt = 180,
  role = 'defender',
  isUIHidden = false,
  castleHp = 10,
  maxCastleHp = 10,
}) => {
  // Timer state synchronized with server phaseEndsAt
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return phaseEndsAt > 0 ? Math.ceil(phaseEndsAt) : 180;
  });

  // Brief toast notification on UI toggle
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (phaseEndsAt > 0) {
      setSecondsRemaining(Math.ceil(phaseEndsAt));
    }
  }, [phaseEndsAt]);

  useEffect(() => {
    if (phase === 'gameover') return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Show a quick toast tip when UI visibility flips
  useEffect(() => {
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
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-amber-500/50 shadow-2xl text-[11px] font-bold text-amber-200 backdrop-blur-sm transition-opacity duration-300">
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
        <div className="w-full flex items-start justify-between px-3 sm:px-4 pt-2 pointer-events-none">
          
          {/* Top-Left: Compact Gold Display (140px x 44px) */}
          <div
            className="pointer-events-auto relative w-[140px] h-[44px] flex items-center justify-end pr-3 shadow-lg drop-shadow transition-transform hover:scale-102"
            style={{
              backgroundImage: "url('/assets/ui/hud/hud_gold_badge_clean.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <span className="text-amber-200 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-xs sm:text-sm tracking-wide font-['Almendra',serif]">
              GOLD: {gold}g
            </span>
          </div>

          {/* Top-Center: Exactly Centered Wave & Timer HUD (180px x 60px) */}
          <div
            className="pointer-events-auto fixed top-2 left-1/2 -translate-x-1/2 w-[180px] h-[60px] flex flex-col items-center justify-between pb-1.5 pt-1.5 drop-shadow-[0_6px_14px_rgba(0,0,0,0.9)] transition-transform"
            style={{
              backgroundImage: "url('/assets/ui/hud/hud_wave_banner.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* Upper Spire: Small 10px gold Wave indicator */}
            <span className="text-amber-300/90 text-[10px] font-bold tracking-widest drop-shadow">
              WAVE 1
            </span>

            {/* Lower Plaque: Prominent 14px-16px countdown clock */}
            <div className="w-20 text-center pb-0.5">
              <span className="text-amber-100 font-bold text-sm sm:text-base tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                {phase === 'combat' ? 'COMBAT' : timeFormatted}
              </span>
            </div>
          </div>

          {/* Top-Right: Settings Medallion (32px x 32px) + Integrated Castle HP Indicator */}
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            <button
              onClick={onOpenMenu}
              aria-label="Open Game Settings"
              className="w-8 h-8 rounded-full active:scale-95 hover:scale-105 transition shadow-lg drop-shadow cursor-pointer flex items-center justify-center p-0 border-0 bg-transparent"
            >
              <img
                src="/assets/ui/hud/hud_settings_btn.png"
                alt="Settings"
                className="w-full h-full object-contain"
              />
            </button>

            {/* Compact Base Castle HP Badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/85 border border-amber-600/50 shadow-md text-[10px] text-amber-100 font-bold">
              <span>🏰</span>
              <span>{castleHp}/{maxCastleHp}</span>
              <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (castleHp / maxCastleHp) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-Center: Minecraft-Style Building Hotbar (Horizontal Scrollable) */}
        {(role === 'defender' || phase === 'building') && (
          <div className="pointer-events-auto fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center max-w-[96vw]">
            <div
              className="relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-lg shadow-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)] bg-gradient-to-r from-red-950/95 via-[#450a0a]/95 to-red-950/95 border border-amber-600/80 overflow-x-auto scrollbar-none touch-pan-x"
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
                    className={`relative flex-shrink-0 w-[42px] h-[44px] sm:w-[46px] sm:h-[48px] flex flex-col items-center justify-between p-0.5 rounded transition-all cursor-pointer ${
                      isSelected ? 'scale-105 z-10' : 'hover:scale-102 opacity-95'
                    } ${!canAfford ? 'opacity-55 saturate-50' : ''}`}
                    title={`${tower?.name ?? towerId} (${cost}g)`}
                  >
                    {/* Compact Tower Icon (24px x 24px) */}
                    <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded">
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
                      <span className="text-[8px] font-bold text-amber-200 leading-none truncate block">
                        {shortName} / {cost}g
                      </span>
                    </div>

                    {/* Insufficient gold indicator */}
                    {!canAfford && (
                      <div className="absolute inset-0 bg-red-950/60 rounded flex items-center justify-center pointer-events-none">
                        <span className="text-[8px] text-red-300 font-black drop-shadow">
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
      </aside>
    </>
  );
};
