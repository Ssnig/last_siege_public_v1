import React, { useEffect, useState } from 'react';
import { TOWER_TYPES, MOB_TYPES, type AttackerArmyPayload } from '@root/shared';

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
  attackerArmy?: AttackerArmyPayload | null;
  onAddBatch?: (pathId: string, typeId: string, count: number) => void;
  onReleaseWave?: (pathIds?: string[]) => void;
  onClearWave?: (pathId: string) => void;
}

const DEFAULT_DEFENDER_TOWERS = [
  'basic',
  'pitchfork',
  'poison',
  'crossbow',
  'cannon',
  'sniper',
];

const DEFAULT_ATTACKER_MOBS = [
  'grunt',
  'runner',
  'brute',
  'shade',
  'spider',
  'orc',
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

const MOB_SHORT_NAMES: Record<string, string> = {
  grunt: 'Grunt',
  runner: 'Run',
  brute: 'Brute',
  shade: 'Shade',
  spider: 'Spdr',
  orc: 'Orc',
  gargoyle: 'Garg',
  sapper: 'Sapr',
  necromancer: 'Necro',
  ogre: 'Ogre',
};

const MOB_ICONS: Record<string, string> = {
  grunt: '/assets/sprites/unit_warrior.png',
  runner: '/assets/sprites/spawn3.png',
  brute: '/assets/sprites/spawn5.png',
  shade: '/assets/sprites/spawn4.png',
  spider: '/assets/sprites/spawn6.png',
  orc: '/assets/sprites/spawn2.png',
  gargoyle: '/assets/sprites/spawn5.png',
  sapper: '/assets/sprites/spawn1.png',
  necromancer: '/assets/sprites/spawn4.png',
  ogre: '/assets/sprites/spawn6.png',
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
  castleHp = 30,
  maxCastleHp = 30,
  incomeRate,
  attackerArmy = null,
  onAddBatch,
  onReleaseWave,
  onClearWave,
}) => {
  // Timer state synchronized with server phaseEndsAt
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return phaseEndsAt > 0 ? Math.ceil(phaseEndsAt) : 30;
  });

  const [selectedPath, setSelectedPath] = useState<'top' | 'bottom'>('top');

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

  // Mobs in tray for attacker
  const availableMobs = (deck && deck.length > 0 ? deck : DEFAULT_ATTACKER_MOBS).slice(0, 6);
  const selectedPathArmy = attackerArmy?.paths?.find((p) => p.pathId === selectedPath);
  const stagedCount = selectedPathArmy?.troopCount ?? 0;
  const stagedGold = selectedPathArmy?.goldCost ?? 0;
  const totalStagedCount = attackerArmy?.paths?.reduce((sum, p) => sum + p.troopCount, 0) ?? 0;
  const totalStagedGold = attackerArmy?.paths?.reduce((sum, p) => sum + p.goldCost, 0) ?? 0;

  const handleSpawnMob = (mobId: string) => {
    const mob = MOB_TYPES[mobId];
    const count = mob && mob.cost >= 30 ? 1 : 2;
    if (onAddBatch) {
      onAddBatch(selectedPath, mobId, count);
    }
  };

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
          
          {/* Top-Left: Dynamic Responsive Gold Display */}
          <div
            className="pointer-events-auto relative w-[130px] h-[38px] md:w-[180px] md:h-[50px] flex items-center justify-end pr-2.5 md:pr-4 shadow-lg drop-shadow transition-transform hover:scale-102"
            style={{
              backgroundImage: "url('/assets/ui/hud/hud_gold_badge_clean.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="flex flex-col items-end justify-center leading-none">
              <span className="text-amber-200 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-xs md:text-base tracking-wide font-['Almendra',serif]">
                GOLD: {gold}g
              </span>
              {incomeRate !== undefined && (
                <span className="text-emerald-300 font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] text-[9px] md:text-[11px] tracking-tight font-sans">
                  +{incomeRate}g/s
                </span>
              )}
            </div>
          </div>

          {/* Top-Center: Exactly Centered Wave & Timer Banner with Pixel-Perfect Plaque Alignment */}
          <div
            className="pointer-events-auto fixed top-1.5 md:top-3 left-1/2 -translate-x-1/2 w-32 h-[78px] md:w-44 md:h-[108px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.9)] transition-transform select-none"
            style={{
              backgroundImage: "url('/assets/ui/hud/hud_wave_banner.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* Live Numeric Countdown Clock — Exactly aligned in the lower golden plaque */}
            <div className="absolute top-[70%] h-[22%] inset-x-0 flex items-center justify-center pointer-events-none">
              <span className="font-['Almendra',serif] font-bold text-amber-100 text-[11px] md:text-sm tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                {phase === 'combat' ? 'COMBAT' : timeFormatted}
              </span>
            </div>
          </div>

          {/* Top-Right: Settings Medallion + Dynamic Castle HP Indicator */}
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            <button
              onClick={onOpenMenu}
              aria-label="Open Game Settings"
              className="w-8 h-8 md:w-11 md:h-11 rounded-full active:scale-95 hover:scale-105 transition shadow-lg drop-shadow cursor-pointer flex items-center justify-center p-0 border-0 bg-transparent"
            >
              <img
                src="/assets/ui/hud/hud_settings_btn.png"
                alt="Settings"
                className="w-full h-full object-contain"
              />
            </button>

            {/* Compact Base Castle HP Badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md bg-slate-950/85 border border-amber-600/50 shadow-md text-[10px] md:text-xs text-amber-100 font-bold">
              <span>🏰</span>
              <span>{castleHp}/{maxCastleHp}</span>
              <div className="w-10 h-1.5 md:w-16 md:h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
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
                    className={`relative flex-shrink-0 w-[42px] h-[44px] md:w-[56px] md:h-[62px] flex flex-col items-center justify-between p-0.5 rounded transition-all cursor-pointer ${
                      isSelected ? 'scale-105 z-10' : 'hover:scale-102 opacity-95'
                    } ${!canAfford ? 'opacity-55 saturate-50' : ''}`}
                    title={`${tower?.name ?? towerId} (${cost}g)`}
                  >
                    {/* Tower Icon */}
                    <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center overflow-hidden rounded">
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

        {/* Bottom-Center: Attacker Wave Hotbar */}
        {role === 'attacker' && (
          <div className="pointer-events-auto fixed bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[96vw]">
            {/* Lane Selector Tabs & Staged Status */}
            <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1 rounded-full border border-amber-600/60 shadow-lg text-xs font-bold">
              <span className="text-amber-400 text-[10px] md:text-xs">LANE:</span>
              <button
                onClick={() => setSelectedPath('top')}
                className={`px-2.5 py-0.5 rounded-full transition-all text-[10px] md:text-xs cursor-pointer ${
                  selectedPath === 'top'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    : 'text-amber-200/70 hover:text-amber-100 bg-slate-800/80'
                }`}
              >
                ▲ TOP {attackerArmy?.paths?.find((p) => p.pathId === 'top')?.troopCount ? `(${attackerArmy.paths.find((p) => p.pathId === 'top')!.troopCount})` : ''}
              </button>
              <button
                onClick={() => setSelectedPath('bottom')}
                className={`px-2.5 py-0.5 rounded-full transition-all text-[10px] md:text-xs cursor-pointer ${
                  selectedPath === 'bottom'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    : 'text-amber-200/70 hover:text-amber-100 bg-slate-800/80'
                }`}
              >
                ▼ BOTTOM {attackerArmy?.paths?.find((p) => p.pathId === 'bottom')?.troopCount ? `(${attackerArmy.paths.find((p) => p.pathId === 'bottom')!.troopCount})` : ''}
              </button>

              {stagedCount > 0 && onClearWave && (
                <button
                  onClick={() => onClearWave(selectedPath)}
                  title="Clear staged lane"
                  className="ml-1 text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer"
                >
                  Clear ({stagedGold}g)
                </button>
              )}
            </div>

            {/* Units Tray & Staged Release Action Bar */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Unit Cards */}
              <div
                className="relative flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg shadow-2xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)] bg-gradient-to-r from-red-950/95 via-[#450a0a]/95 to-red-950/95 border border-amber-600/80 overflow-x-auto scrollbar-none touch-pan-x"
                style={{
                  boxShadow: '0 0 14px rgba(0,0,0,0.85), inset 0 0 8px rgba(251,191,36,0.3)',
                }}
              >
                {availableMobs.map((mobId) => {
                  const mob = MOB_TYPES[mobId];
                  const cost = mob?.cost ?? 10;
                  const canAfford = gold >= cost;
                  const iconSrc = MOB_ICONS[mobId] || '/assets/sprites/unit_warrior.png';
                  const shortName = MOB_SHORT_NAMES[mobId] || mob?.name?.slice(0, 4) || mobId;

                  return (
                    <button
                      key={mobId}
                      onClick={() => handleSpawnMob(mobId)}
                      disabled={!canAfford}
                      className={`relative flex-shrink-0 w-[44px] h-[46px] md:w-[58px] md:h-[64px] flex flex-col items-center justify-between p-0.5 rounded transition-all cursor-pointer ${
                        canAfford ? 'hover:scale-105 active:scale-95' : 'opacity-50 saturate-50 cursor-not-allowed'
                      }`}
                      title={`${mob?.name ?? mobId} (${cost}g)`}
                    >
                      <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center overflow-hidden rounded bg-black/40">
                        <img
                          src={iconSrc}
                          alt={mob?.name ?? mobId}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="w-full text-center bg-black/75 rounded-b py-[1px] px-0.5">
                        <span className="text-[8px] md:text-[10px] font-bold text-amber-200 leading-none truncate block">
                          {shortName} / {cost}g
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Release Wave Button (Combat Phase) or Staged Indicator (Building Phase) */}
              {phase === 'combat' && (
                <button
                  onClick={() => onReleaseWave?.()}
                  disabled={totalStagedCount === 0}
                  className={`flex-shrink-0 px-3 py-2 md:px-4 md:py-3 rounded-lg font-black text-[11px] md:text-xs uppercase tracking-wider shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                    totalStagedCount > 0
                      ? 'bg-gradient-to-r from-red-600 via-amber-500 to-red-600 text-white animate-pulse active:scale-95 border-2 border-amber-300'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <span>⚔️ RELEASE</span>
                  <span className="text-[9px] font-normal">
                    {totalStagedCount > 0 ? `${totalStagedCount} units (${totalStagedGold}g)` : 'Stage Units'}
                  </span>
                </button>
              )}
              {phase === 'building' && (
                <div className="flex-shrink-0 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg bg-slate-900/90 border border-amber-500/40 text-amber-200 text-center text-[10px] md:text-xs">
                  <div className="font-bold">STAGED ARMY</div>
                  <div className="text-[9px] text-amber-400">{totalStagedCount} units ({totalStagedGold}g)</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom-Right: Start Battle Button for Defender during Building Phase */}
        {phase === 'building' && role === 'defender' && onStartBattle && (
          <button
            onClick={onStartBattle}
            aria-label="Start Battle"
            className="pointer-events-auto fixed bottom-2.5 right-2.5 md:bottom-4 md:right-4 z-40 px-3.5 py-2 md:px-5 md:py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] border-2 border-amber-300 flex items-center gap-1.5 transition-all cursor-pointer font-['Almendra',serif]"
          >
            <span className="text-sm md:text-base">⚔️</span>
            <span>Start Battle</span>
          </button>
        )}
      </aside>
    </>
  );
};
