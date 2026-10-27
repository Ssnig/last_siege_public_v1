import React, { useEffect, useRef, useState } from 'react';
import { MATCH_RULES, DEFAULT_ECONOMY, TOWER_TYPES, getTowerDesign } from '@root/shared';
import { useSmoothCountdown } from './useSmoothCountdown';
import { DamageTypeBadge } from './DamageTypeBadge';
import { damageTypeOfTower } from '../../game/damageTypes';
import { soundEffects } from '../../audio/soundEffects';
import { TutorialQuickGuideModal } from '../tutorial/TutorialQuickGuideModal';

interface GameHUDProps {
  gold: number;
  maxGold?: number;
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
  /** True once the siege timer has expired with troops still on the field. */
  suddenDeath?: boolean;
  onToggleUI?: () => void;
}

const DEFAULT_DEFENDER_TOWERS = [
  'archer',
  'crossbow',
  'bomb',
  'bell',
  'spear',
  'gun',
];

const TOWER_SHORT_NAMES: Record<string, string> = {
  archer: 'Arc',
  basic: 'Arc',
  crossbow: 'Xbw',
  cannon: 'Xbw',
  bomb: 'Bmb',
  bell: 'Bel',
  spear: 'Spr',
  pitchfork: 'Spr',
  gun: 'Gun',
  sniper: 'Gun',
  sein_pyaung: 'SnP',
};

const TOWER_ICONS: Record<string, string> = {
  archer: '/assets/towers/01_archer_tower/icon.jpg',
  basic: '/assets/towers/01_archer_tower/icon.jpg',
  crossbow: '/assets/towers/02_crossbow_fort/icon.jpg',
  cannon: '/assets/towers/02_crossbow_fort/icon.jpg',
  bomb: '/assets/towers/03_bomb_throwing_tower/icon.jpg',
  bell: '/assets/towers/04_bell_tower/icon.jpg',
  spear: '/assets/towers/05_spear_tower/icon.jpg',
  pitchfork: '/assets/towers/05_spear_tower/icon.jpg',
  gun: '/assets/towers/06_gun_tower/icon.jpg',
  sniper: '/assets/towers/06_gun_tower/icon.jpg',
  water_cannon: '/assets/towers/07_water_cannon/icon.jpg',
  chinthe: '/assets/towers/08_chinthe_statue/icon.jpg',
  dragon: '/assets/towers/09_dragon_tower/icon.jpg',
  sein_pyaung: '/assets/towers/10_sein_pyaung/icon.jpg',
};

export const GameHUD: React.FC<GameHUDProps> = ({
  gold,
  maxGold = DEFAULT_ECONOMY.maxGold ?? 750,
  deck,
  selectedTowerType = 'basic',
  onSelectTower,
  onOpenMenu,
  onStartBattle,
  phase = 'building',
  phaseEndsAt = 30,
  role = 'defender',
  isUIHidden = false,
  castleHp = MATCH_RULES.coreHp,
  maxCastleHp = MATCH_RULES.coreHp,
  incomeRate,
  suddenDeath = false,
  onToggleUI,
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
    setToastMessage(isUIHidden ? 'UI Hidden (Double-tap anywhere to show)' : 'UI Restored');
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isUIHidden]);

  // War drum countdown cadence and battle start gong
  const prevSecondsRef = useRef<number>(secondsRemaining);
  const prevPhaseRef = useRef<string>(phase);

  useEffect(() => {
    // Phase change from building to combat triggers grand war drum + ceremonial gong + screen flash
    if (prevPhaseRef.current === 'building' && phase === 'combat') {
      soundEffects.playWarDrum('battleStart');
      window.dispatchEvent(new CustomEvent('game:flash', { detail: { color: 'rgba(239, 68, 68, 0.45)' } }));
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // Sync low castle HP / sudden death with danger vignette
  useEffect(() => {
    const isCritical = (castleHp / maxCastleHp) < 0.3 || suddenDeath;
    window.dispatchEvent(new CustomEvent('game:danger', { detail: { active: isCritical } }));
    return () => {
      window.dispatchEvent(new CustomEvent('game:danger', { detail: { active: false } }));
    };
  }, [castleHp, maxCastleHp, suddenDeath]);

  useEffect(() => {
    // Building phase countdown war drums (seconds 5 down to 1)
    if (phase === 'building' && secondsRemaining !== prevSecondsRef.current) {
      if (secondsRemaining <= 5 && secondsRemaining >= 4) {
        soundEffects.playWarDrum('light');
      } else if (secondsRemaining <= 3 && secondsRemaining >= 1) {
        soundEffects.playWarDrum('heavy');
      }
    }
    prevSecondsRef.current = secondsRemaining;
  }, [phase, secondsRemaining]);

  // Format MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Towers in tray: strictly top 6 slots (or deck if provided)
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [showCoachTip, setShowCoachTip] = useState<boolean>(true);

  const coachTip = React.useMemo(() => {
    if (phase === 'building') {
      return role === 'defender'
        ? 'Click stone pads along corners to place towers before the countdown ends!'
        : 'Defender is setting up fortifications. Review your deck on the deploy bar!';
    }
    if (phase === 'combat') {
      return role === 'attacker'
        ? 'Queue troops in your deploy buffer and click a portal to launch your siege squad!'
        : 'Slay invading troops to collect gold bounties and upgrade your towers mid-battle!';
    }
    return null;
  }, [phase, role]);

  const availableTowers = (deck && deck.length > 0 ? deck : DEFAULT_DEFENDER_TOWERS).slice(0, 6);

  return (
    <>
      {/* Toast notification indicator for Double-Tap UI toggle */}
      {toastMessage && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-amber-500/50 shadow-2xl text-[11px] md:text-xs font-bold text-amber-200 backdrop-blur-sm transition-opacity duration-300">
          {toastMessage}
        </div>
      )}

      {/* Fallback button when UI is hidden so user is never stuck */}
      {isUIHidden && (
        <button
          onClick={onToggleUI}
          className="pointer-events-auto fixed top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-slate-900/90 border border-amber-500/70 text-amber-300 text-xs font-bold shadow-2xl hover:bg-slate-800 transition active:scale-95 flex items-center gap-1.5 cursor-pointer animate-fadeIn"
          title="Restore HUD"
        >
          <span>👁️</span> Show UI
        </button>
      )}

      {/* Main Game HUD Container with smooth 0.3s ease transition */}
      <aside
        aria-label="Game HUD"
        className={`pointer-events-none fixed inset-0 z-40 select-none overflow-hidden font-['Almendra',serif] transition-opacity duration-300 ${
          isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Top Header Row: Gold (Left), Centered Wave/Timer, Settings + Castle HP (Right) */}
        {/* Constrained to max-w-[min(100vw,calc(100dvh*16/9))] so HUD frames the 16:9 arena on ultrawide viewports */}
        <div className="w-full flex items-start justify-between px-[max(0.75rem,env(safe-area-inset-left,0.75rem))] pr-[max(0.75rem,env(safe-area-inset-right,0.75rem))] sm:px-4 md:px-6 pt-2 pointer-events-none">
          
          {/* Top-Left: Gold display */}
          <div className="flex items-center gap-1.5 md:gap-2">
            {(() => {
              const isCapped = gold >= maxGold;
              return (
                <div
                  className={`pointer-events-auto relative w-[112px] h-[34px] md:w-[156px] md:h-[44px] flex items-center justify-end pr-2 md:pr-3 shadow-lg drop-shadow transition-transform hover:scale-102 ${
                    isCapped ? 'ring-2 ring-amber-400 rounded-lg shadow-[0_0_12px_rgba(251,191,36,0.6)]' : ''
                  }`}
                  style={{
                    backgroundImage: "url('/assets/ui/hud/hud_gold_badge_clean.png')",
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                  }}
                  title={isCapped ? `Gold Cap Reached (${maxGold}g)! Spend gold before incoming income is lost.` : undefined}
                >
                  <div className="flex flex-col items-end justify-center leading-none">
                    <div className="flex items-center gap-1">
                      <span className={`font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-xs md:text-[15px] tracking-wide font-['Almendra',serif] ${
                        isCapped ? 'text-amber-300 animate-pulse' : 'text-amber-200'
                      }`}>
                        GOLD: {gold}g
                      </span>
                      {isCapped && (
                        <span className="text-[8px] md:text-[9px] font-black uppercase px-1 py-0.2 bg-amber-500 text-slate-950 rounded font-mono shadow">
                          MAX
                        </span>
                      )}
                    </div>
                    {incomeRate !== undefined && (
                      <span className={`font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] text-[10px] md:text-xs tracking-tight font-sans ${
                        isCapped ? 'text-amber-300/80 line-through' : 'text-emerald-300'
                      }`}>
                        +{incomeRate}g/s
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Top-Center: Pure Royal Countdown Timer Plaque (No Wave sign, Clean Countdown for Both Sides) */}
          <div
            className="pointer-events-auto fixed top-2 md:top-3 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center px-4 py-1.5 md:px-5 md:py-2 rounded-full select-none transition-all duration-200"
            style={{
              background: suddenDeath
                ? 'linear-gradient(180deg, #4a0404 0%, #1f0202 100%)'
                : 'linear-gradient(180deg, #3a0a0e 0%, #1a0507 100%)',
              border: suddenDeath ? '2px solid #ef4444' : '2px solid #d4af37',
              boxShadow: suddenDeath
                ? '0 0 16px rgba(239, 68, 68, 0.7), inset 0 1px 0 rgba(254, 202, 202, 0.4)'
                : '0 4px 14px rgba(0,0,0,0.85), 0 0 10px rgba(212, 175, 55, 0.35), inset 0 1px 0 rgba(254, 240, 138, 0.3)',
            }}
          >
            {/* Clock / Death icon */}
            <span className="text-amber-400 text-xs sm:text-sm mr-1.5 drop-shadow">
              {suddenDeath ? '☠' : '⏱'}
            </span>

            {/* Prominent Live Numeric Countdown */}
            <span
              className={`font-['Cinzel','Almendra',serif] font-black text-sm sm:text-base md:text-lg tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${
                suddenDeath
                  ? 'text-red-300 animate-pulse'
                  : secondsRemaining <= 10
                    ? 'text-amber-300 animate-pulse'
                    : 'text-[#fff5d6]'
              }`}
            >
              {suddenDeath ? 'SUDDEN DEATH' : timeFormatted}
            </span>
          </div>

          {/* Top-Right: Settings Medallion + Quick Guide Button + Dynamic Castle HP Indicator */}
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundEffects.playModal();
                  setIsGuideOpen(true);
                }}
                title="Tactical Battle Guide"
                className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-slate-900/90 border border-amber-500/60 hover:border-amber-300 text-amber-300 text-xs md:text-sm font-black flex items-center justify-center transition shadow-md active:scale-95 cursor-pointer hover:scale-105"
              >
                ❓
              </button>

              <button
                onClick={() => { soundEffects.playModal(); onOpenMenu(); }}
                aria-label="Open Game Settings"
                className="w-7 h-7 md:w-9 md:h-9 rounded-full active:scale-95 hover:scale-105 transition shadow-lg drop-shadow cursor-pointer flex items-center justify-center p-0 border-0 bg-transparent"
              >
                <img
                  src="/assets/ui/hud/hud_settings_btn.png"
                  alt="Settings"
                  className="w-full h-full object-contain"
                />
              </button>
            </div>

            {/* Compact Base Castle HP Badge with Smooth Dynamic Health Color Shift */}
            {(() => {
              const hpRatio = Math.max(0, Math.min(1, castleHp / maxCastleHp));
              const isLowHp = hpRatio < 0.3;
              return (
                <div className={`flex items-center gap-1.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md bg-slate-950/85 border shadow-md text-[11px] md:text-sm font-bold transition-all duration-300 ${
                  isLowHp ? 'border-rose-500/80 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 'border-amber-600/50 text-amber-100'
                }`}>
                  <span className={isLowHp ? 'animate-bounce' : ''}>🏰</span>
                  <span>{castleHp}/{maxCastleHp}</span>
                  <div className="w-9 h-1.5 md:w-14 md:h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        hpRatio < 0.25
                          ? 'bg-gradient-to-r from-red-600 to-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                          : hpRatio < 0.55
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-500'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                      }`}
                      style={{ width: `${hpRatio * 100}%` }}
                    />
                  </div>
                </div>
              );
            })()}
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
                const iconSrc = TOWER_ICONS[towerId] || getTowerDesign(towerId)?.iconPath || '/assets/ui/hud/slot_arrow.png';
                const shortName = TOWER_SHORT_NAMES[towerId] || tower?.name?.slice(0, 3) || towerId.slice(0, 3);

                return (
                  <button
                    key={towerId}
                    onClick={() => { soundEffects.playHover(); onSelectTower(towerId); }}
                    className={`relative flex-shrink-0 w-[34px] h-[36px] sm:w-[38px] sm:h-[40px] md:w-[50px] md:h-[54px] flex flex-col items-center justify-between p-0.5 rounded transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'scale-110 -translate-y-1 z-10 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                        : 'hover:-translate-y-0.5 hover:scale-105 opacity-95'
                    } active:scale-95 ${!canAfford ? 'opacity-55 saturate-50' : ''}`}
                    title={`${tower?.name ?? towerId} (${cost}g)`}
                  >
                    {/* Tower Icon */}
                    <div className="w-5 h-5 md:w-7 md:h-7 flex items-center justify-center overflow-hidden rounded">
                      <img
                        src={iconSrc}
                        alt={tower?.name ?? towerId}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Damage-type badge on the card border */}
                    <span className="absolute -top-1 -left-1 z-10">
                      <DamageTypeBadge type={damageTypeOfTower(towerId)} size={16} />
                    </span>

                    {/* Golden Glowing Selection Halo */}
                    {isSelected && (
                      <div
                        className="absolute -inset-1 pointer-events-none rounded border-2 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.95),inset_0_0_6px_rgba(251,191,36,0.5)] animate-pulse"
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

        {/* Contextual Battle Coach Tip Banner */}
        {coachTip && showCoachTip && (
          <div className="pointer-events-auto fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[90vw] px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-amber-500/50 shadow-2xl text-[10px] md:text-xs text-amber-200 flex items-center justify-between gap-2 backdrop-blur-md animate-fadeIn">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-amber-400 font-bold shrink-0">💡 Battle Coach:</span>
              <span className="truncate">{coachTip}</span>
            </div>
            <button
              onClick={() => setShowCoachTip(false)}
              className="text-amber-400/70 hover:text-white text-xs px-1 cursor-pointer shrink-0"
              title="Dismiss tip"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bottom-Right: Start Battle Button for Defender during Building Phase */}
        {phase === 'building' && role === 'defender' && onStartBattle && (
          <button
            onClick={() => { soundEffects.playWarDrum('battleStart'); onStartBattle(); }}
            aria-label="Start Battle"
             className="pointer-events-auto fixed bottom-2.5 right-2.5 md:bottom-4 md:right-4 z-40 px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider shadow-[0_0_22px_rgba(245,158,11,0.6)] hover:shadow-[0_0_32px_rgba(245,158,11,0.85)] hover:scale-105 border-2 border-amber-300 flex items-center gap-1.5 transition-all cursor-pointer font-['Almendra',serif] animate-pulse"
          >
            <span className="text-xs md:text-sm">⚔️</span>
            <span>Start Battle</span>
          </button>
        )}
      </aside>

      {/* In-Match Quick Guide Slideover Modal */}
      <TutorialQuickGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        defaultTab={role === 'attacker' ? 'attacker' : 'defender'}
      />
    </>
  );
};
