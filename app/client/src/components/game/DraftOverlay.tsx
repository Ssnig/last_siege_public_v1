import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import {
  MESSAGES,
  MOB_TYPES,
  TOWER_TYPES,
  ACTIVE_TOWER_IDS,
  CORE_UNIT_IDS,
  getTowerDesign,
  type DraftRoundUpdatePayload,
  type MobType,
  type TowerType,
} from '@root/shared';

import { useSmoothCountdown } from './useSmoothCountdown';
import { DamageTypeBadge } from './DamageTypeBadge';
import { damageTypeOfTower } from '../../game/damageTypes';
import { soundEffects } from '../../audio/soundEffects';

interface DraftOverlayProps {
  room: Room;
  role: 'attacker' | 'defender';
  serverSeconds?: number;
  onConfirm?: (deck: string[]) => void;
}

export interface EffectTag {
  label: string;
  style: string;
  description?: string;
}

interface TacticalData {
  title: string;
  nickname?: string;
  isEnemy?: boolean;
  stat1Label: string;
  stat1Value: string | number;
  stat2Label: string;
  stat2Value: string | number;
  stat3Label: string;
  stat3Value: string | number;
  weakness: string;
  strongAgainst?: string[];
  weakAgainst?: string[];
  notes?: string;
  stacks: string;
  iconSrc?: string;
  /** Extra stat pairs shown under the tactical row (damage type, armor, ...). */
  traits?: { label: string; value: string }[];
  /** Concise effect tags representing active skills and unique traits (Heal, Buff, Stun, etc.) */
  effectTags?: EffectTag[];
}

const TACTICAL_TOWERS: Record<string, Partial<TacticalData>> = {
  archer: {
    title: 'ARCHER TOWER',
    weakness: 'Armored Swarms',
    stacks: 'Max 8',
    iconSrc: '/assets/towers/01_archer_tower/icon.jpg',
  },
  basic: {
    title: 'ARCHER TOWER',
    weakness: 'Armored Swarms',
    stacks: 'Max 8',
    iconSrc: '/assets/towers/01_archer_tower/icon.jpg',
  },
  cannon: {
    title: 'CANNON',
    weakness: 'Quick Units',
    stacks: 'Max 5',
    iconSrc: '/assets/towers/02_cannon/icon.png',
  },
  bomb: {
    title: 'BOMB THROWING TOWER',
    weakness: 'Single Fast Targets',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/03_bomb_throwing_tower/icon.jpg',
  },
  bell: {
    title: 'BELL TOWER',
    weakness: 'Long-Range Snipers',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/04_bell_tower/icon.jpg',
  },
  spear: {
    title: 'SPEAR TOWER',
    weakness: 'Heavy Cavalry',
    stacks: 'Max 8',
    iconSrc: '/assets/towers/05_spear_tower/icon.jpg',
  },
  pitchfork: {
    title: 'SPEAR TOWER',
    weakness: 'Heavy Cavalry',
    stacks: 'Max 8',
    iconSrc: '/assets/towers/05_spear_tower/icon.jpg',
  },
  gun: {
    title: 'GUN TOWER',
    weakness: 'Dense Swarms',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/06_gun_tower/icon.jpg',
  },
  sniper: {
    title: 'GUN TOWER',
    weakness: 'Dense Swarms',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/06_gun_tower/icon.jpg',
  },
  water_cannon: {
    title: 'WATER CANNON',
    weakness: 'Fast Units',
    stacks: 'Max 6',
    iconSrc: '/assets/towers/07_water_cannon/icon.jpg',
  },
  chinthe: {
    title: 'CHINTHE GUARDIAN',
    weakness: 'Armored Swarms',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/08_chinthe_statue/icon.jpg',
  },
  dragon: {
    title: 'DRAGON TOWER',
    weakness: 'Resistant Hordes',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/09_dragon_tower/icon.jpg',
  },
  sein_pyaung: {
    title: 'SEIN PYAUNG',
    weakness: 'Heavy Armor & Swarms',
    stacks: 'Max 4',
    iconSrc: '/assets/towers/10_sein_pyaung/icon.jpg',
  },
  arcanist: {
    title: 'ROYAL ARCANIST',
    weakness: 'Fast Magic Wards',
    stacks: 'Max 5',
  },
  tesla: {
    title: 'TESLA COIL',
    weakness: 'Long-Range Siege',
    stacks: 'Max 4',
  },
  archmage: {
    title: 'HIGH ARCHMAGE',
    weakness: 'Speed Rushers',
    stacks: 'Max 3',
  },
  bertha: {
    title: 'BIG BERTHA MORTAR',
    weakness: 'Fast Runners',
    stacks: 'Max 2',
  },
};

const TACTICAL_MOBS: Record<string, Partial<TacticalData>> = {
  horse_rider: {
    title: 'KONBAUNG CAVALRY',
    weakness: 'Spike Pitches & Traps',
    stacks: 'Max 15',
    iconSrc: '/assets/units/horse_rider/face.png',
  },
  sar_bal_gyi: {
    title: 'PALACE ROYAL GUARD',
    weakness: 'Armor Piercing Bolts',
    stacks: 'Max 10',
    iconSrc: '/assets/units/sar_bal_gyi/face.png',
  },
  gya_pu: {
    title: 'WINGED NAT SPIRIT',
    weakness: 'Snipers & Anti-Air',
    stacks: 'Max 12',
    iconSrc: '/assets/units/gya_pu/face.png',
  },
  a_ba: {
    title: 'SPIRIT MEDIUM (A-BA)',
    weakness: 'Concentrated Burst',
    stacks: 'Max 10',
    iconSrc: '/assets/units/a_ba/face.png',
  },
  chon_toe: {
    title: 'BUSH SNEAK (CHON-TOE)',
    weakness: 'Poison & Sticky Tar',
    stacks: 'Max 6',
    iconSrc: '/assets/units/chon_toe/face.png',
  },
  elephant_rider: {
    title: 'WAR ELEPHANT',
    weakness: 'Mental Attacks & Artillery',
    stacks: 'Max 3',
    iconSrc: '/assets/units/elephant_rider/face.jpg',
  },
  monkey: {
    title: 'MONKEY',
    weakness: 'Splash & Area Towers',
    stacks: 'Max 40',
    iconSrc: '/assets/units/monkey/face.jpg',
  },
  say_sayar: {
    title: 'SAY SAYAR',
    weakness: 'Single-Target Burst',
    stacks: 'Max 8',
    iconSrc: '/assets/units/say_sayar/face.jpg',
  },
  shield_guy: {
    title: 'SHIELD BEARER',
    weakness: 'Mental Attacks & Artillery',
    stacks: 'Max 8',
    iconSrc: '/assets/units/shield_guy/face.jpg',
  },
  doe_pat: {
    title: 'DOE PAT DRUMMER',
    weakness: 'Long-Range Snipers',
    stacks: 'Max 8',
    iconSrc: '/assets/units/doe_pat/face.jpg',
  },
  bandit: {
    title: 'BANDIT RAIDER',
    weakness: 'Heavy Armor & Rapid Fire',
    stacks: 'Max 12',
    iconSrc: '/assets/units/Bandit/face.jpg',
  },
  belu: {
    title: 'BELU OGRE',
    weakness: 'Mental Attacks & Artillery',
    stacks: 'Max 4',
    iconSrc: '/assets/units/Belu/face.jpg',
  },
  brute: {
    title: 'HEAVY BRUTE',
    weakness: 'Piercing Arrows & Kiting',
    stacks: 'Max 6',
    iconSrc: '/assets/units/Brute/face.jpg',
  },
  general: {
    title: 'ROYAL BO GENERAL',
    weakness: 'Concentrated Single-Target Burst',
    stacks: 'Max 6',
    iconSrc: '/assets/units/General/face.jpg',
  },
  sone_ma: {
    title: 'SONE MA SORCERESS',
    weakness: 'Physical Snipers & Swarms',
    stacks: 'Max 8',
    iconSrc: '/assets/units/SoneMa/face.jpg',
  },
};

/** Concise effect tag badge data for mobs (e.g. Heal, Buff, Stun, Adaptive, Taunt) */
export function getMobEffectTags(mobOrId: MobType | string): EffectTag[] {
  const mob: MobType | undefined =
    typeof mobOrId === 'string' ? MOB_TYPES[mobOrId] : mobOrId;
  const id = typeof mobOrId === 'string' ? mobOrId : mob?.id;
  if (!mob && !id) return [];

  const tags: EffectTag[] = [];

  // Active / Special skill effects
  if (mob?.ability?.type === 'heal_aura') {
    tags.push({
      label: 'Heal',
      style: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300',
      description: 'Emits a healing aura to nearby wounded allies',
    });
  } else if (mob?.ability?.type === 'self_heal') {
    tags.push({
      label: 'Self Heal',
      style: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300',
      description: 'Periodically regenerates health when damaged',
    });
  }

  if (mob?.ability?.type === 'speed_aura') {
    tags.push({
      label: 'Buff',
      style: 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300',
      description: 'Grants +40% speed boost aura to nearby allies',
    });
  }

  if (mob?.adaptiveDefense) {
    tags.push({
      label: 'Adaptive',
      style: 'bg-amber-950/90 border-amber-500/80 text-amber-300',
      description: 'Gains armor stacks from physical hits, mental resistance from mental hits',
    });
  }

  if ((mob as any)?.onDeathTowerStunSec) {
    tags.push({
      label: 'Stun',
      style: 'bg-purple-950/90 border-purple-500/80 text-purple-300',
      description: `Hex Curse: Stuns the killing tower for ${(mob as any).onDeathTowerStunSec}s on death`,
    });
  }

  if ((mob as any)?.taunt) {
    tags.push({
      label: 'Taunt',
      style: 'bg-rose-950/90 border-rose-500/80 text-rose-300',
      description: 'Forces defender towers in range to attack him first',
    });
  }

  if ((mob as any)?.speedRamp) {
    tags.push({
      label: 'Speed Ramp',
      style: 'bg-sky-950/90 border-sky-500/80 text-sky-300',
      description: 'Continuously accelerates over travel time up to 2x speed',
    });
  }

  if (mob?.damagedSpeed && mob.speed > mob.damagedSpeed) {
    tags.push({
      label: 'Speed Burst',
      style: 'bg-yellow-950/90 border-yellow-500/80 text-yellow-300',
      description: 'High initial sprint speed until struck by tower damage',
    });
  }

  // Tactical traits for baseline units without active skills
  if (tags.length === 0) {
    if ((mob?.armor ?? 0) >= 8) {
      tags.push({
        label: 'Heavy Armor',
        style: 'bg-stone-900/90 border-stone-500/80 text-stone-300',
        description: 'Heavy physical armor plating',
      });
    } else if ((mob?.maxHp ?? 0) >= 1000) {
      tags.push({
        label: 'Colossal',
        style: 'bg-orange-950/90 border-orange-500/80 text-orange-300',
        description: 'Colossal health pool with massive leak damage',
      });
    } else if ((mob?.mentalStrength ?? 0) >= 1 && (mob?.armor ?? 0) === 0) {
      tags.push({
        label: 'Spirit',
        style: 'bg-indigo-950/90 border-indigo-500/80 text-indigo-300',
        description: 'Spiritual entity with full mental resistance',
      });
    } else if ((mob?.armor ?? 0) >= 4) {
      tags.push({
        label: 'Armored',
        style: 'bg-stone-900/90 border-stone-500/80 text-stone-300',
      });
    } else if ((mob?.speed ?? 0) >= 100) {
      tags.push({
        label: 'Fast',
        style: 'bg-zinc-900/90 border-zinc-500/80 text-zinc-300',
      });
    }
  }

  return tags;
}

/** 1-line tactical note explaining special mob abilities in the Unit Overview */
export function getMobEffectNote(mobOrId: MobType | string): string | undefined {
  const mob: MobType | undefined =
    typeof mobOrId === 'string' ? MOB_TYPES[mobOrId] : mobOrId;
  if (!mob) return undefined;

  if (mob.ability?.type === 'heal_aura') {
    return 'Emits an 80 HP healing pulse to nearby wounded allies every 6s.';
  }
  if (mob.ability?.type === 'self_heal') {
    return 'Regenerates 10% maximum health every 10s when injured.';
  }
  if (mob.ability?.type === 'speed_aura') {
    return 'Grants +40% speed boost aura to nearby allies for 4s.';
  }
  if (mob.adaptiveDefense) {
    return 'Gains armor stacks from physical hits and mental resistance from mental hits (max 5 stacks).';
  }
  if ((mob as any).onDeathTowerStunSec) {
    return `Hex Curse: Stuns the tower that killed her for ${(mob as any).onDeathTowerStunSec} seconds.`;
  }
  if ((mob as any).taunt) {
    return 'Battle Roar: Forces all defender towers in range to focus fire on him.';
  }
  if ((mob as any).speedRamp) {
    return 'Nat Spirit Pace: Accelerates along the lane, reaching 2x speed after 25 seconds.';
  }
  if (mob.damagedSpeed && mob.speed > mob.damagedSpeed) {
    return `Burst Sprint: Sprints at ${mob.speed} speed until struck, then slows to ${mob.damagedSpeed}.`;
  }
  return undefined;
}

/** Concise specialty tags for towers in the inspector overview */
export function getTowerEffectTags(towerOrId: any): EffectTag[] {
  const tower = typeof towerOrId === 'string' ? TOWER_TYPES[towerOrId] : towerOrId;
  const id = typeof towerOrId === 'string' ? towerOrId : tower?.id;
  if (!tower && !id) return [];

  const tags: EffectTag[] = [];
  if (id === 'cannon' || id === 'bomb') {
    tags.push({
      label: 'AoE',
      style: 'bg-orange-950/90 border-orange-500/80 text-orange-300',
      description: 'Area-of-effect splash damage',
    });
  } else if (id === 'sein_pyaung') {
    tags.push({
      label: 'Mortar',
      style: 'bg-orange-950/90 border-orange-500/80 text-orange-300',
      description: 'Heavy long-range explosive mortar',
    });
  } else if (id === 'water_cannon') {
    tags.push({
      label: 'Slow',
      style: 'bg-blue-950/90 border-blue-500/80 text-blue-300',
      description: 'Slows target movement speed',
    });
  } else if (id === 'chinthe') {
    tags.push({
      label: 'Stun',
      style: 'bg-purple-950/90 border-purple-500/80 text-purple-300',
      description: 'Chance to briefly stun targets',
    });
  } else if (id === 'dragon') {
    tags.push({
      label: 'Explosion',
      style: 'bg-red-950/90 border-red-500/80 text-red-300',
      description: 'Killed targets explode dealing AoE damage',
    });
  } else if (id === 'spear') {
    tags.push({
      label: 'Armor Pen',
      style: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300',
      description: 'Bypasses enemy physical armor',
    });
  } else if (id === 'gun' || id === 'sniper') {
    tags.push({
      label: 'Sniper',
      style: 'bg-amber-950/90 border-amber-500/80 text-amber-300',
      description: 'High-damage long-range precision shots',
    });
  }
  return tags;
}

/** SVG corner filigree for royal panels */
const CornerFlourish: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({ position }) => {
  const transform =
    position === 'tr'
      ? 'scaleX(-1)'
      : position === 'bl'
        ? 'scaleY(-1)'
        : position === 'br'
          ? 'scale(-1, -1)'
          : undefined;

  return (
    <div
      className={`absolute pointer-events-none z-20 ${
        position.startsWith('t') ? 'top-0' : 'bottom-0'
      } ${position.endsWith('l') ? 'left-0' : 'right-0'}`}
      style={{ transform }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M2 22 L2 6 C2 3.8 3.8 2 6 2 L22 2"
          stroke="#fce38a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M6 16 L6 8 C6 6.9 6.9 6 8 6 L16 6"
          stroke="#d4af37"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="4" cy="4" r="2" fill="#ffe066" />
      </svg>
    </div>
  );
};

export const DraftOverlay: React.FC<DraftOverlayProps> = ({
  room,
  role = 'defender',
  serverSeconds,
  onConfirm,
}) => {
  // Authoritative role from room state or fallback to prop
  const effectiveRole = useMemo(() => {
    const stateRole = room?.state?.players?.get(room?.sessionId)?.role;
    if (stateRole === 'attacker' || stateRole === 'defender') return stateRole;
    return role;
  }, [room, role]);

  // Synced mob pool from server for this match (all available units)
  const [syncedMobPool, setSyncedMobPool] = useState<string[]>(() => {
    const pool = (room?.state as any)?.draftMobPool;
    if (pool && pool.length > 0) {
      return Array.from(pool);
    }
    return CORE_UNIT_IDS;
  });

  // Items in player's own catalog
  const catalogList = useMemo(() => {
    if (effectiveRole === 'defender') {
      return ACTIVE_TOWER_IDS.map((id) => TOWER_TYPES[id]).filter(Boolean);
    }
    const pool = (syncedMobPool && syncedMobPool.length > 0)
      ? syncedMobPool
      : ((room?.state as any)?.draftMobPool && (room?.state as any).draftMobPool.length > 0)
        ? Array.from((room?.state as any).draftMobPool)
        : CORE_UNIT_IDS;
    return (pool as string[]).map((id) => MOB_TYPES[id]).filter(Boolean);
  }, [effectiveRole, syncedMobPool, room?.state]);

  // Round tracking (1, 2, or 3)
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [lockedPicks, setLockedPicks] = useState<string[]>([]); // Picks committed from previous rounds
  const [roundPicks, setRoundPicks] = useState<string[]>([]);   // Picks made in current round (max 2)
  const [roundSeconds, setRoundSeconds] = useState<number>(15);
  const [isRoundReady, setIsRoundReady] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 5-second post-draft countdown after round 3
  const [isFinalCountdown, setIsFinalCountdown] = useState<boolean>(false);
  const [isWaitingForAssets, setIsWaitingForAssets] = useState<boolean>(false);
  const [finalSeconds, setFinalSeconds] = useState<number>(5);

  const smoothSeconds = useSmoothCountdown(
    serverSeconds ?? 0,
    serverSeconds !== undefined && serverSeconds > 0,
  );
  const effectiveRoundSeconds = serverSeconds !== undefined ? smoothSeconds : roundSeconds;
  const effectiveFinalSeconds = serverSeconds !== undefined ? smoothSeconds : finalSeconds;

  // War drum cadence during final countdown
  const prevFinalSecRef = useRef<number>(effectiveFinalSeconds);
  useEffect(() => {
    if (isFinalCountdown && effectiveFinalSeconds !== prevFinalSecRef.current) {
      if (effectiveFinalSeconds <= 5 && effectiveFinalSeconds >= 4) {
        soundEffects.playWarDrum('light');
      } else if (effectiveFinalSeconds <= 3 && effectiveFinalSeconds >= 1) {
        soundEffects.playWarDrum('heavy');
      } else if (effectiveFinalSeconds === 0) {
        soundEffects.playWarDrum('battleStart');
      }
    }
    prevFinalSecRef.current = effectiveFinalSeconds;
  }, [isFinalCountdown, effectiveFinalSeconds]);

  // Opponent state & revealed enemy picks
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [enemyPicks, setEnemyPicks] = useState<string[]>([]);

  // 16:9 Virtual viewport scale factor for all screen sizes to maintain uniform desktop-style layout
  const [viewportScale, setViewportScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const availableWidth = Math.min(
      window.innerWidth,
      document.documentElement.clientWidth || window.innerWidth,
    );
    const availableHeight = Math.min(
      window.innerHeight,
      document.documentElement.clientHeight || window.innerHeight,
    );
    const scaleX = (availableWidth * 0.98) / 1260;
    const scaleY = (availableHeight * 0.98) / 700;
    return Math.max(0.15, Math.min(scaleX, scaleY));
  });

  useEffect(() => {
    const updateScale = () => {
      // 1260x700 virtual canvas scale-to-fit
      const availableWidth = Math.min(
        window.innerWidth,
        document.documentElement.clientWidth || window.innerWidth,
      );
      const availableHeight = Math.min(
        window.innerHeight,
        document.documentElement.clientHeight || window.innerHeight,
      );
      const scaleX = (availableWidth * 0.98) / 1260;
      const scaleY = (availableHeight * 0.98) / 700;
      const fit = Math.min(scaleX, scaleY);
      setViewportScale(Math.max(0.15, fit));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, []);

  // Inspected item (can be own unit/tower OR an enemy unit/tower)
  const [inspectedTarget, setInspectedTarget] = useState<{ id: string; isEnemy: boolean }>({
    id: catalogList[0]?.id || '',
    isEnemy: false,
  });

  // Keep a ref to current round picks to avoid stale closures in timers
  const roundPicksRef = useRef<string[]>(roundPicks);
  roundPicksRef.current = roundPicks;
  const lockedPicksRef = useRef<string[]>(lockedPicks);
  lockedPicksRef.current = lockedPicks;
  const currentRoundRef = useRef<number>(currentRound);
  currentRoundRef.current = currentRound;
  const isRoundReadyRef = useRef<boolean>(isRoundReady);
  isRoundReadyRef.current = isRoundReady;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // Auto-pick random units from unselected catalog entries to reach 2 picks
  const autoPickForCurrentRound = useCallback(() => {
    const committed = lockedPicksRef.current;
    const current = roundPicksRef.current;
    const available = catalogList
      .map((c) => c.id)
      .filter((id) => !committed.includes(id) && !current.includes(id));

    const finalPicks = [...current];
    while (finalPicks.length < 2 && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      finalPicks.push(available.splice(idx, 1)[0]);
    }

    setRoundPicks(finalPicks);
    return finalPicks;
  }, [catalogList]);

  const autoPickRef = useRef(autoPickForCurrentRound);
  autoPickRef.current = autoPickForCurrentRound;

  // Submit picks for current round
  const submitCurrentRoundPicks = useCallback(
    (picksToSubmit?: string[]) => {
      const picks = picksToSubmit ?? roundPicksRef.current;
      if (isRoundReadyRef.current) return;
      setIsRoundReady(true);
      setErrorMsg(null);

      // Send to server (the 2-2-2 draftPick protocol commits all 3 rounds on the server)
      room.send(MESSAGES.draftPick, {
        round: currentRoundRef.current,
        picks,
      });
    },
    [room],
  );

  const submitPicksRef = useRef(submitCurrentRoundPicks);
  submitPicksRef.current = submitCurrentRoundPicks;

  // 5-second final countdown timer when all 3 rounds conclude
  useEffect(() => {
    if (!isFinalCountdown) return;

    const timer = setInterval(() => {
      setFinalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinalCountdown]);

  // 15-second countdown timer per round
  useEffect(() => {
    if (isFinalCountdown) return;

    setRoundSeconds(15);
    setIsRoundReady(false);

    const timer = setInterval(() => {
      setRoundSeconds((prev) => {
        if (prev <= 1) {
          // Timer expired! Auto-pick and submit if not already ready
          if (!isRoundReadyRef.current) {
            const filled = autoPickRef.current();
            submitPicksRef.current(filled);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRound, isFinalCountdown]);

  // Colyseus message listeners
  useEffect(() => {
    // Sync opponent name from state
    if (room?.state?.players) {
      room.state.players.forEach((p: any, sessionId: string) => {
        if (sessionId !== room.sessionId && p.name) {
          setOpponentName(p.name);
        }
      });
    }

    // Listen for draft round update broadcast from server
    const offUpdate = room.onMessage(
      MESSAGES.draftRoundUpdate,
      (payload: DraftRoundUpdatePayload) => {
        const isDefender = effectiveRole === 'defender';
        const opponentPicks = isDefender ? payload.attackerPicks : payload.defenderPicks;
        const myPicks = isDefender ? payload.defenderPicks : payload.attackerPicks;

        if (opponentPicks) setEnemyPicks(opponentPicks);
        if (myPicks) setLockedPicks(myPicks);
        if (payload.availableMobPool && payload.availableMobPool.length > 0) {
          setSyncedMobPool(payload.availableMobPool);
        }

        if (payload.isFinalReveal) {
          setIsFinalCountdown(true);
          setIsWaitingForAssets(Boolean(payload.waitingForAssets));
          if (!payload.waitingForAssets) {
            setFinalSeconds(payload.phaseEndsAt || 5);
          }
          setIsRoundReady(true);
          setRoundPicks([]);
        } else if (payload.round >= currentRoundRef.current && payload.round < 3) {
          // Advance to next round if round has completed
          setCurrentRound(payload.round + 1);
          setRoundPicks([]);
          setIsRoundReady(false);
          setRoundSeconds(15);
        }
      },
    );

    const offAssetStatus = room.onMessage(
      MESSAGES.assetLoadingStatus,
      (payload: { waitingForAssets: boolean; loadedCount: number; totalCount: number }) => {
        setIsWaitingForAssets(Boolean(payload.waitingForAssets));
      },
    );

    const offReject = room.onMessage(MESSAGES.draftRejected, (payload: { reason?: string }) => {
      setIsRoundReady(false);
      setErrorMsg(payload?.reason || 'Draft selection was rejected by server.');
    });

    return () => {
      offUpdate();
      offAssetStatus();
      offReject();
    };
  }, [room, effectiveRole]);

  // Combine locked picks + current round picks
  const allYourSelections = useMemo(() => {
    return [...lockedPicks, ...roundPicks];
  }, [lockedPicks, roundPicks]);

  // Toggle selection for current round
  const toggleSelect = (id: string) => {
    // If waiting or in final countdown, clicking cards should only inspect them
    if (isRoundReady || isFinalCountdown) {
      soundEffects.playHover();
      setInspectedTarget({ id, isEnemy: false });
      return;
    }

    if (lockedPicks.includes(id)) {
      soundEffects.playHover();
      setInspectedTarget({ id, isEnemy: false });
      return;
    }

    soundEffects.playClick();

    setErrorMsg(null);
    setInspectedTarget({ id, isEnemy: false });

    setRoundPicks((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[0], id]; // Replace second pick
      }
      return [...prev, id];
    });
  };

  const removeCurrentPick = (id: string) => {
    if (isRoundReady || isFinalCountdown) return;
    if (lockedPicks.includes(id)) return; // Cannot remove locked picks
    setErrorMsg(null);
    setRoundPicks((prev) => prev.filter((x) => x !== id));
  };

  const handleManualConfirm = () => {
    if (roundPicks.length !== 2 || isRoundReady || isFinalCountdown) return;
    soundEffects.playClick();
    submitCurrentRoundPicks(roundPicks);
  };

  // Build tactical inspector data for inspected target (can be friendly or enemy)
  const inspectorData: TacticalData = useMemo(() => {
    const { id, isEnemy } = inspectedTarget;
    const isTargetTower = isEnemy ? effectiveRole === 'attacker' : effectiveRole === 'defender';

    if (isTargetTower) {
      const tower = (TOWER_TYPES[id] as TowerType) || catalogList[0];
      const tier0 = tower?.tiers?.[0];
      const custom = TACTICAL_TOWERS[id] || {};
      const spd =
        (tier0?.fireRate ?? 1) > 1.3
          ? 'Fast'
          : (tier0?.fireRate ?? 1) < 0.6
            ? 'Slow'
            : 'Medium';

      const strongAgainst = (tower as any)?.strongAgainst ?? [];
      const weakAgainst = (tower as any)?.weakAgainst ?? (custom.weakness ? [custom.weakness] : []);
      const traits: { label: string; value: string }[] = [
        {
          label: 'Damage',
          value: damageTypeOfTower(id) === 'mental' ? 'Mental' : 'Physical',
        },
      ];
      if ((tower as any)?.armorPenetration) {
        traits.push({
          label: 'Armor Pen',
          value: `${Math.round((tower as any).armorPenetration * 100)}%`,
        });
      }

      return {
        title: custom.title || tower?.name?.toUpperCase() || id.toUpperCase(),
        nickname: (tower as any)?.nickname,
        isEnemy,
        stat1Label: 'ATK',
        stat1Value: tier0?.damage ?? 15,
        stat2Label: 'RNG',
        stat2Value: tier0?.range ?? 120,
        stat3Label: 'SPD',
        stat3Value: spd,
        weakness: weakAgainst.length > 0 ? weakAgainst.join(', ') : custom.weakness || 'High Mobility',
        strongAgainst,
        weakAgainst,
        notes: (tower as any)?.notes,
        stacks: custom.stacks || 'Max 6',
        iconSrc: custom.iconSrc || getTowerDesign(id)?.iconPath,
        traits,
        effectTags: getTowerEffectTags(tower ?? id),
      };
    } else {
      const mob = (MOB_TYPES[id] as MobType) || catalogList[0];
      const custom = TACTICAL_MOBS[id] || {};
      const spd =
        (mob?.speed ?? 60) > 100
          ? 'Sprint'
          : (mob?.speed ?? 60) > 75
            ? 'Fast'
            : (mob?.speed ?? 60) < 50
              ? 'Slow'
              : 'Normal';

      const strongAgainst = (mob as any)?.strongAgainst ?? [];
      const weakAgainst = (mob as any)?.weakAgainst ?? (custom.weakness ? [custom.weakness] : []);

      return {
        title: custom.title || mob?.name?.toUpperCase() || id.toUpperCase(),
        nickname: (mob as any)?.nickname,
        isEnemy,
        stat1Label: 'HP',
        stat1Value: mob?.maxHp ?? 100,
        stat2Label: 'Cost',
        stat2Value: `${mob?.cost ?? 10}g`,
        stat3Label: 'SPD',
        stat3Value: spd,
        weakness: weakAgainst.length > 0 ? weakAgainst.join(', ') : custom.weakness || 'Concentrated Fire',
        strongAgainst,
        weakAgainst,
        notes: (mob as any)?.notes || getMobEffectNote(mob ?? id),
        stacks: custom.stacks || 'Max 20',
        iconSrc: custom.iconSrc,
        traits: [
          { label: 'Armor', value: String(mob?.armor ?? 0) },
          { label: 'Mental', value: `${Math.round((mob?.mentalStrength ?? 0.5) * 100)}%` },
        ],
        effectTags: getMobEffectTags(mob ?? id),
      };
    }
  }, [inspectedTarget, effectiveRole, catalogList]);

  // Top-left card badge: damage type badge for towers or concise effect tag for mobs
  const renderUnitTagBadge = (id: string) => {
    if (TOWER_TYPES[id]) {
      return (
        <span className="absolute -top-1.5 -left-1.5 z-10">
          <DamageTypeBadge type={damageTypeOfTower(id)} size={18} />
        </span>
      );
    }
    const tags = getMobEffectTags(id);
    if (tags.length === 0) return null;
    const primary = tags[0];
    return (
      <span className="absolute -top-1 -left-1 z-10 pointer-events-none">
        <span
          className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase tracking-wider border shadow-md ${primary.style}`}
          title={primary.description}
        >
          {primary.label}
        </span>
      </span>
    );
  };

  // Render illustration / sprite
  const renderItemVisual = (id: string, isTargetEnemy: boolean = false, isBig: boolean = false) => {
    const isTargetTower = isTargetEnemy ? effectiveRole === 'attacker' : effectiveRole === 'defender';
    const custom = isTargetTower ? TACTICAL_TOWERS[id] : TACTICAL_MOBS[id];
    const iconSrc = custom?.iconSrc || (isTargetTower ? getTowerDesign(id)?.iconPath : undefined);

    if (iconSrc) {
      return (
        <img
          src={iconSrc}
          alt={id}
          className={`${
            isBig ? 'max-h-24 max-w-24' : 'max-h-12 max-w-12'
          } object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]`}
          style={{ imageRendering: 'auto' }}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center text-amber-900 font-black">
        <svg
          width={isBig ? 64 : 32}
          height={isBig ? 64 : 32}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 2 L28 10 L28 28 L4 28 L4 10 Z"
            fill={isTargetEnemy ? '#dc2626' : '#d97706'}
            stroke={isTargetEnemy ? '#7f1d1d' : '#92400e'}
            strokeWidth="2"
          />
          <path d="M12 28 L12 20 L20 20 L20 28 Z" fill="#450a0a" />
          <circle cx="16" cy="12" r="3" fill="#fef08a" />
        </svg>
      </div>
    );
  };

  const confirmButton = isFinalCountdown ? (
    isWaitingForAssets ? (
      <button
        type="button"
        disabled
        className="relative w-full py-3 sm:py-3.5 rounded-lg font-black tracking-widest text-base sm:text-lg overflow-hidden flex items-center justify-center bg-gradient-to-r from-amber-950 via-amber-800 to-amber-950 border-2 border-amber-400 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.5)] cursor-default animate-pulse"
        style={{ textShadow: '2px 2px 0px #000' }}
      >
        <CornerFlourish position="tl" />
        <CornerFlourish position="tr" />
        <CornerFlourish position="bl" />
        <CornerFlourish position="br" />
        <span className="flex items-center gap-2">WAITING FOR ASSET LOADING...</span>
      </button>
    ) : (
      <button
        type="button"
        disabled
        className="relative w-full py-3 sm:py-3.5 rounded-lg font-black tracking-widest text-base sm:text-lg overflow-hidden flex items-center justify-center bg-gradient-to-r from-emerald-950 via-emerald-800 to-emerald-950 border-2 border-[#ffe066] text-[#fff5d6] shadow-[0_0_25px_rgba(255,224,102,0.6)] cursor-default animate-pulse"
        style={{ textShadow: '2px 2px 0px #000' }}
      >
        <CornerFlourish position="tl" />
        <CornerFlourish position="tr" />
        <CornerFlourish position="bl" />
        <CornerFlourish position="br" />
        <span className="flex items-center gap-2">
          PREPARE FOR BATTLE ({effectiveFinalSeconds}s)
        </span>
      </button>
    )
  ) : (
    <button
      type="button"
      onClick={handleManualConfirm}
      disabled={roundPicks.length !== 2 || isRoundReady}
      className={`relative w-full py-3 sm:py-3.5 rounded-lg font-black tracking-widest text-base sm:text-lg transition-all duration-200 overflow-hidden flex items-center justify-center ${
        isRoundReady
          ? 'bg-gradient-to-r from-emerald-900 via-emerald-700 to-emerald-900 border-2 border-emerald-400 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-default'
          : roundPicks.length === 2
            ? 'bg-gradient-to-r from-[#7a1218] via-[#bd2029] to-[#7a1218] border-2 border-[#ffe066] text-[#fff5d6] shadow-[0_0_25px_rgba(255,224,102,0.6)] hover:brightness-110 active:scale-[0.99] cursor-pointer animate-pulse'
            : 'bg-gradient-to-r from-[#380e12] to-[#20080a] border-2 border-amber-900/60 text-amber-700/70 cursor-not-allowed'
      }`}
      style={{ textShadow: '2px 2px 0px #000' }}
    >
      <CornerFlourish position="tl" />
      <CornerFlourish position="tr" />
      <CornerFlourish position="bl" />
      <CornerFlourish position="br" />

      {isRoundReady ? (
        <span className="flex items-center gap-2">
          ROUND {currentRound} READY (Waiting...)
        </span>
      ) : roundPicks.length === 2 ? (
        <span>CONFIRM ROUND {currentRound} ({effectiveRoundSeconds}s)</span>
      ) : (
        <span>
          CHOOSE 2 FOR ROUND {currentRound} ({roundPicks.length}/2) [{effectiveRoundSeconds}s]
        </span>
      )}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-40 w-full h-[100dvh] flex select-none text-[#fff5d6] animate-fadeIn items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #1c1117 0%, #140d13 70%, #0a060a 100%)',
        fontFamily: "'Cinzel', 'MedievalSharp', serif",
      }}
    >
      {/* 16:9 Scale-to-Fit Canvas Frame matching Desktop */}
      <div
        className="relative shrink-0 origin-center transition-transform duration-75 flex flex-col gap-2 w-[1260px] h-[700px] justify-between rounded-xl p-3 overflow-hidden"
        style={{
          transform: `scale(${viewportScale})`,
          border: '3px solid #d4af37',
          boxShadow: '0 0 0 2px #420b0e, 0 0 30px rgba(0,0,0,0.9), inset 0 0 40px rgba(0,0,0,0.7)',
          background: 'linear-gradient(180deg, #180f15 0%, #11090f 100%)',
          WebkitTextSizeAdjust: '100%',
        }}
      >
        <CornerFlourish position="tl" />
        <CornerFlourish position="tr" />
        <CornerFlourish position="bl" />
        <CornerFlourish position="br" />

        {/* Error Notification Toast if any */}
        {errorMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-900 border-2 border-amber-400 rounded-lg text-sm text-yellow-200 font-bold shadow-2xl animate-bounce">
            [!] {errorMsg}
          </div>
        )}

        {/* Desktop two-column 7/5 grid */}
        <div className="flex-1 w-full min-h-0 grid grid-cols-12 gap-3 overflow-hidden">
          {/* ===================== LEFT COLUMN (~60%: 7 cols) ===================== */}
          <div className="flex flex-col gap-2 min-h-0 col-span-7">
            {/* Top Header Banner with Dynamic Round Timer */}
            <div
              className="relative flex items-center justify-between gap-1.5 py-1.5 px-4 rounded-lg text-center"
              style={{
                background: isFinalCountdown
                  ? isWaitingForAssets
                    ? 'linear-gradient(90deg, #451a03 0%, #78350f 50%, #451a03 100%)'
                    : 'linear-gradient(90deg, #1e3a1f 0%, #15803d 50%, #1e3a1f 100%)'
                  : 'linear-gradient(90deg, #5b0f13 0%, #9e1b22 50%, #5b0f13 100%)',
                border: isFinalCountdown
                  ? isWaitingForAssets
                    ? '2px solid #f59e0b'
                    : '2px solid #34d399'
                  : '2px solid #d4af37',
                boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.3), 0 3px 10px rgba(0,0,0,0.6)',
              }}
            >
              {isFinalCountdown ? (
                isWaitingForAssets ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-200">
                      <span className="px-2.5 py-0.5 rounded bg-black/50 border border-amber-400">
                        DRAFT COMPLETE
                      </span>
                    </div>

                    <span
                      className="text-base sm:text-lg font-black tracking-widest text-[#fef08a] animate-pulse"
                      style={{ textShadow: '2px 2px 0px #000' }}
                    >
                      WAITING FOR OPPONENT TO LOAD ASSETS...
                    </span>

                    <div className="flex items-center gap-1 px-3 py-0.5 rounded-full font-black text-xs sm:text-sm border bg-amber-950/90 border-amber-400 text-amber-300">
                      <span>SYNC</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-200">
                      <span className="px-2.5 py-0.5 rounded bg-black/50 border border-emerald-400">
                        DRAFT COMPLETE
                      </span>
                    </div>

                    <span
                      className="text-base sm:text-lg font-black tracking-widest text-[#fef08a] animate-pulse"
                      style={{ textShadow: '2px 2px 0px #000' }}
                    >
                      BATTLE COMMENCES IN {effectiveFinalSeconds}s
                    </span>

                    <div className="flex items-center gap-1 px-3 py-0.5 rounded-full font-black text-xs sm:text-sm border bg-emerald-950/90 border-emerald-400 text-emerald-300">
                      <span>{effectiveFinalSeconds}s</span>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#fef08a]">
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-amber-500/50">
                      ROUND {currentRound}/3
                    </span>
                    <span className="text-amber-200/80">(Pick 2)</span>
                  </div>

                  <span
                    className="text-base sm:text-lg font-black tracking-widest text-[#fff5d6]"
                    style={{ textShadow: '2px 2px 0px #000' }}
                  >
                    {effectiveRole === 'defender' ? 'CHOOSE YOUR TOWERS' : 'CHOOSE YOUR UNITS'}
                  </span>

                  {/* 15-second countdown pill */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm border ${
                      effectiveRoundSeconds <= 3
                        ? 'bg-red-900/90 border-red-400 text-red-200 animate-pulse'
                        : 'bg-black/60 border-amber-400 text-amber-300'
                    }`}
                  >
                    <span>{effectiveRoundSeconds}s</span>
                  </div>
                </>
              )}
            </div>

            {/* Middle Panel — Details Inspector (Inspects Own or Enemy Selections) */}
            <div
              className="relative rounded-lg p-2 flex items-center gap-3 shrink-0"
              style={{
                background: inspectorData.isEnemy
                  ? 'linear-gradient(135deg, #3d0c11 0%, #200508 100%)'
                  : 'linear-gradient(135deg, #2b0b0e 0%, #1e0709 100%)',
                border: inspectorData.isEnemy ? '2px solid #ef4444' : '2px solid #d4af37',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.6)',
              }}
            >
              <CornerFlourish position="tl" />
              <CornerFlourish position="br" />

              {/* Left side: Square portrait frame */}
              <div
                className="relative w-20 h-20 shrink-0 rounded-lg flex items-center justify-center p-1.5 overflow-hidden"
                style={{
                  background: '#e6d2b5',
                  border: inspectorData.isEnemy ? '3px solid #ef4444' : '3px solid #d4af37',
                  boxShadow: 'inset 0 0 10px rgba(146,64,14,0.4), 0 4px 10px rgba(0,0,0,0.6)',
                }}
              >
                {renderItemVisual(inspectedTarget.id, inspectorData.isEnemy, true)}
              </div>

              {/* Right side: Crimson info box with gold trim */}
              <div
                className="flex-1 min-w-0 rounded-lg p-2 flex flex-col justify-center"
                style={{
                  background: 'linear-gradient(90deg, #420b0e 0%, #5e1116 100%)',
                  border: inspectorData.isEnemy ? '1.5px solid #ef4444' : '1.5px solid #d4af37',
                  boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.2)',
                }}
              >
                <div className="flex items-center justify-between gap-1 truncate">
                  <div
                    className="text-base font-black text-[#fff5d6] truncate tracking-wide flex items-center gap-1.5"
                    style={{ textShadow: '2px 2px 0px #000' }}
                  >
                    <span>{inspectorData.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {inspectorData.effectTags?.map((tag) => (
                      <span
                        key={tag.label}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shadow-sm ${tag.style}`}
                        title={tag.description}
                      >
                        {tag.label}
                      </span>
                    ))}
                    {inspectorData.isEnemy ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-950 border border-red-500 text-red-300">
                        ENEMY UNIT
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950 border border-amber-500 text-amber-300">
                        YOUR ROSTER
                      </span>
                    )}
                  </div>
                </div>

                {/* Horizontal Gold Divider */}
                <div className="w-full h-0.5 my-1 bg-gradient-to-r from-[#fce38a] via-[#d4af37] to-transparent" />

                {/* Stats Row */}
                <div className="text-xs sm:text-sm font-bold text-[#fef08a] flex flex-wrap items-center gap-x-3 gap-y-0.5 tracking-tight">
                  <span>
                    {inspectorData.stat1Label}: <span className="text-white">{inspectorData.stat1Value}</span>
                  </span>
                  <span className="text-amber-500/70">|</span>
                  <span>
                    {inspectorData.stat2Label}: <span className="text-white">{inspectorData.stat2Value}</span>
                  </span>
                  <span className="text-amber-500/70">|</span>
                  <span>
                    {inspectorData.stat3Label}: <span className="text-white">{inspectorData.stat3Value}</span>
                  </span>
                  {inspectorData.traits && inspectorData.traits.length > 0 && (
                    <>
                      <span className="text-amber-500/70">|</span>
                      {inspectorData.traits.map((trait, index) => (
                        <span key={trait.label}>
                          {index > 0 && <span className="mx-1 text-amber-500/70">•</span>}
                          <span className="text-amber-300 font-semibold">{trait.label}:</span>{' '}
                          <span className="text-white">{trait.value}</span>
                        </span>
                      ))}
                    </>
                  )}
                </div>

                {/* Notes/Ability line if available */}
                {inspectorData.notes && (
                  <div className="text-[10px] text-amber-300/90 italic mt-0.5 truncate">
                    {inspectorData.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Panel — Selection Pool Cards (Scrollable for 15+ Units) */}
            <div
              className="relative flex-1 rounded-lg p-2 flex flex-col min-h-0 overflow-hidden min-h-[220px]"
              style={{
                background: 'rgba(26, 12, 17, 0.9)',
                border: '2px solid #8a661b',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
              }}
            >
              {catalogList.length > 10 && (
                <div className="flex items-center justify-between pb-1 px-1 text-xs text-amber-300/80 font-mono shrink-0">
                  <span>Available Roster ({catalogList.length} units)</span>
                  <span className="text-[10px] text-amber-400/70 italic">Scroll for more</span>
                </div>
              )}
              <div
                className="flex-1 overflow-y-auto pr-1 min-h-0 overscroll-contain"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="grid grid-cols-5 gap-2">
                  {catalogList.map((item) => {
                    const isLocked = lockedPicks.includes(item.id);
                    const isRoundPick = roundPicks.includes(item.id);
                    const isInspected = inspectedTarget.id === item.id && !inspectedTarget.isEnemy;

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleSelect(item.id)}
                        className={`group relative rounded-md flex flex-col justify-between p-1 select-none overflow-hidden transition-all duration-150 transform min-h-[110px] ${
                          isLocked
                            ? 'opacity-85 cursor-default'
                            : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                        }`}
                        style={{
                          background: isLocked
                            ? 'linear-gradient(180deg, #3d1f14 0%, #20110a 100%)'
                            : isRoundPick
                              ? 'linear-gradient(180deg, #4a1215 0%, #2f080b 100%)'
                              : 'linear-gradient(180deg, #241418 0%, #160a0e 100%)',
                          border: isLocked
                            ? '2px solid #fce38a'
                            : isRoundPick
                              ? '2px solid #ffe066'
                              : isInspected
                                ? '2px solid #d4af37'
                                : '1.5px solid #8a661b',
                          boxShadow: isRoundPick
                            ? '0 0 10px rgba(255, 224, 102, 0.7), inset 0 0 6px rgba(255, 224, 102, 0.3)'
                            : '0 2px 6px rgba(0,0,0,0.6)',
                        }}
                      >
                        {/* Top-left badge: Damage type for towers, effect tag for mobs */}
                        {renderUnitTagBadge(item.id)}

                        {/* Center Sprite on Parchment Frame */}
                        <div
                          className="w-full flex-1 min-h-[54px] rounded flex items-center justify-center p-1 overflow-hidden"
                          style={{
                            background: '#e6d2b5',
                            border: '1px solid #c59b27',
                            boxShadow: 'inset 0 0 5px rgba(146,64,14,0.3)',
                          }}
                        >
                          {renderItemVisual(item.id, false)}
                        </div>

                        {/* Bottom Nameplate & Status */}
                        <div className="mt-1 flex flex-col items-center justify-center leading-none text-center">
                          <span
                            className="text-[11px] font-bold text-[#fff5d6] truncate w-full"
                            style={{ textShadow: '1px 1px 0px #000' }}
                          >
                            {item.name}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase mt-0.5 tracking-wider ${
                              isLocked
                                ? 'text-amber-300'
                                : isRoundPick
                                  ? 'text-emerald-400'
                                  : 'text-amber-500/80'
                            }`}
                          >
                            {isLocked ? 'LOCKED IN' : isRoundPick ? 'SELECTED' : 'AVAILABLE'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ===================== RIGHT COLUMN (~40%: 5 cols) ===================== */}
          <div className="flex flex-col justify-between col-span-5 min-h-0 gap-2">
            {/* Top-Right Panel — ENEMY SELECTIONS (Click to Inspect Enemy Unit) */}
            <div
              className="relative rounded-lg p-2 sm:p-2.5 flex flex-col"
              style={{
                background: 'linear-gradient(145deg, #2b0b0e 0%, #1a0608 100%)',
                border: '2px solid #d4af37',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.7)',
              }}
            >
              <CornerFlourish position="tl" />
              <CornerFlourish position="tr" />

              <div className="flex items-center justify-between pb-1 px-1">
                <span
                  className="text-xs sm:text-sm font-black tracking-widest text-[#fce38a]"
                  style={{ textShadow: '2px 2px 0px #000' }}
                >
                  ENEMY SELECTIONS ({opponentName})
                </span>
                <span className="text-[10px] text-red-300 font-bold">
                  {enemyPicks.length}/6 Revealed
                </span>
              </div>

              {/* 3 cols x 2 rows = 6 slots */}
              <div className="grid grid-cols-3 grid-rows-2 gap-1.5 sm:gap-2 pt-1">
                {Array.from({ length: 6 }).map((_, i) => {
                  const revealedEnemyId = enemyPicks[i];
                  const enemyCatalog = role === 'defender' ? MOB_TYPES : TOWER_TYPES;
                  const enemyItem = revealedEnemyId ? enemyCatalog[revealedEnemyId] : null;

                  if (enemyItem) {
                    // Revealed Enemy Card (Clickable to Inspect!)
                    return (
                      <div
                        key={`enemy-revealed-${i}`}
                        onClick={() => setInspectedTarget({ id: enemyItem.id, isEnemy: true })}
                        className="group relative h-20 rounded-md flex flex-col items-center justify-between p-1 cursor-pointer transition transform hover:scale-[1.02] active:scale-95"
                        style={{
                          background: 'linear-gradient(180deg, #471115 0%, #290a0d 100%)',
                          border: '1.5px solid #dc2626',
                          boxShadow: '0 0 8px rgba(220, 38, 38, 0.6)',
                        }}
                        title="Click to inspect enemy stats in Details Inspector"
                      >
                        {renderUnitTagBadge(enemyItem.id)}
                        <div
                          className="w-full flex-1 rounded flex items-center justify-center p-0.5 overflow-hidden"
                          style={{ background: '#e6d2b5' }}
                        >
                          {renderItemVisual(enemyItem.id, true)}
                        </div>
                        <span className="text-[10px] font-bold text-red-200 truncate w-full text-center mt-0.5">
                          {enemyItem.name}
                        </span>
                      </div>
                    );
                  }

                  // Hidden / Selecting Slot
                  return (
                    <div
                      key={`enemy-slot-${i}`}
                      className="relative h-20 rounded-md flex flex-col items-center justify-center p-1 overflow-hidden"
                      style={{
                        background: 'linear-gradient(180deg, #260c10 0%, #180608 100%)',
                        border: '1px solid #7a1f26',
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#b45309"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mb-1"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="text-[9px] font-bold tracking-tighter text-amber-500 animate-pulse">
                        SELECTING...
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Middle-Right Panel — YOUR SELECTIONS */}
            <div
              className="relative rounded-lg p-2 sm:p-2.5 flex flex-col"
              style={{
                background: 'linear-gradient(145deg, #2b0b0e 0%, #1a0608 100%)',
                border: '2px solid #d4af37',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.7)',
              }}
            >
              <CornerFlourish position="tl" />
              <CornerFlourish position="tr" />

              <div className="flex items-center justify-between pb-1 px-1">
                <span
                  className="text-xs sm:text-sm font-black tracking-widest text-[#fce38a]"
                  style={{ textShadow: '2px 2px 0px #000' }}
                >
                  YOUR SELECTIONS
                </span>
                <span className="text-xs font-bold text-amber-200">
                  {allYourSelections.length} / 6
                </span>
              </div>

              {/* 3 cols x 2 rows = 6 slots */}
              <div className="grid grid-cols-3 grid-rows-2 gap-1.5 sm:gap-2 pt-1">
                {Array.from({ length: 6 }).map((_, index) => {
                  const selectedId = allYourSelections[index];
                  const item = selectedId ? catalogList.find((c) => c.id === selectedId) : null;
                  const isCommitted = lockedPicks.includes(selectedId);

                  if (item) {
                    return (
                      <div
                        key={`your-slot-${index}-${selectedId}`}
                        onClick={() => {
                          setInspectedTarget({ id: item.id, isEnemy: false });
                          if (!isCommitted) removeCurrentPick(selectedId);
                        }}
                        className="group relative h-20 rounded-md flex flex-col items-center justify-between p-1 cursor-pointer transition transform hover:scale-[1.02] active:scale-95"
                        style={{
                          background: isCommitted
                            ? 'linear-gradient(180deg, #3d1f14 0%, #20110a 100%)'
                            : 'linear-gradient(180deg, #3d1014 0%, #20070a 100%)',
                          border: isCommitted ? '1.5px solid #fce38a' : '1.5px solid #d4af37',
                          boxShadow: '0 0 8px rgba(212, 175, 55, 0.4)',
                        }}
                        title={isCommitted ? 'Locked in' : 'Click to remove'}
                      >
                        {renderUnitTagBadge(item.id)}
                        <div
                          className="w-full flex-1 rounded flex items-center justify-center p-0.5 overflow-hidden"
                          style={{ background: '#e6d2b5' }}
                        >
                          {renderItemVisual(item.id, false)}
                        </div>
                        <div className="flex items-center justify-between w-full px-0.5 mt-0.5">
                          <span className="text-[10px] font-bold text-[#fff5d6] truncate">
                            {item.name}
                          </span>
                          {isCommitted && <span className="text-[8px] text-amber-300">LOCKED</span>}
                        </div>
                      </div>
                    );
                  }

                  // Empty Slot
                  return (
                    <div
                      key={`empty-slot-${index}`}
                      className="h-20 rounded-md flex flex-col items-center justify-center border border-dashed border-amber-800/60 bg-[#160a0f]/60 text-amber-700/60 font-black text-xs"
                    >
                      <span>Slot {index + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom-Right — CONFIRM BUTTON FOR CURRENT ROUND */}
            <div className="pt-1">{confirmButton}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
