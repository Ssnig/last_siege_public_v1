import React, { useState } from 'react';
import {
  ACTIVE_TOWER_IDS,
  TOWER_DESIGNS,
  TOWER_TYPES,
  type TowerType,
  type TowerDesignConfig,
} from '@root/shared';
import { soundEffects } from '../../audio/soundEffects';
import { DAMAGE_BADGE_STYLE, damageTypeOfTower } from '../../game/damageTypes';

interface TowerLore {
  title: string;
  role: string;
  description: string;
  bestAgainst: string[];
  weakAgainst: string[];
  tacticalTip: string;
}

const TOWER_EXTRA_INFO: Record<string, TowerLore> = {
  archer: {
    title: 'Imperial Bowmen Guard',
    role: 'Multi-Shot Volley Defense',
    description: 'Disciplined archers of the Konbaung Royal Court firing whistling arrows with split focus. Upgrades allow firing at multiple targets simultaneously to decimate swarms.',
    bestAgainst: ['Monkey', 'Gya Pu', 'Doe Pat', 'Swarms'],
    weakAgainst: ['Sar Bal Gyi (High Armor)', 'Chon Toe'],
    tacticalTip: 'Upgrade to Level 2 and Level 3 to engage 2 and 3 simultaneous targets across dense lanes, blunting incoming swarms before they reach the citadel.',
  },
  crossbow: {
    title: 'Imperial Crossbow Fort',
    role: 'Magazine Salvo Burst & Finisher Stun',
    description: 'A fortified garrison equipped with multi-string mechanical crossbows. Unleashes rapid-fire salvos from preloaded magazines; landing all bolts deals bonus finisher damage and stuns the target for 1 second.',
    bestAgainst: ['High HP Bosses', 'Elephant Rider', 'Sar Bal Gyi'],
    weakAgainst: ['Dense Swarms (Overkill Penalty)', 'Fast Single Runners'],
    tacticalTip: 'Focuses high-health priority units with concentrated bursts. If the target dies early in a burst, remaining bolts hit empty ground, making it vulnerable against swarms without splash support.',
  },
  cannon: {
    title: 'Imperial Crossbow Fort',
    role: 'Magazine Salvo Burst & Finisher Stun',
    description: 'A fortified garrison equipped with multi-string mechanical crossbows. Unleashes rapid-fire salvos from preloaded magazines; landing all bolts deals bonus finisher damage and stuns the target for 1 second.',
    bestAgainst: ['High HP Bosses', 'Elephant Rider', 'Sar Bal Gyi'],
    weakAgainst: ['Dense Swarms (Overkill Penalty)', 'Fast Single Runners'],
    tacticalTip: 'Focuses high-health priority units with concentrated bursts. If the target dies early in a burst, remaining bolts hit empty ground, making it vulnerable against swarms without splash support.',
  },
  bomb: {
    title: 'Pyrotechnic Catapult',
    role: 'Heavy Area Splash',
    description: 'Launches earthen pots filled with black powder and burning resin. Deals catastrophic explosive damage across a wide 75px radius.',
    bestAgainst: ['Clustered Infantry', 'Mid-Health Waves'],
    weakAgainst: ['Fast Single Runners', 'Aerial / Spread Formations'],
    tacticalTip: 'High burst damage with a slower attack cadence. Position right behind frontline towers so targets cluster tightly.',
  },
  bell: {
    title: 'Sacred Monastery Bell',
    role: 'Mental AoE Pulse & Armor Piercing',
    description: 'Consecrated Buddhist bell chiming with resonant sound waves. Completely ignores physical armor and cracks the resolve of all foes in range, amplifying all subsequent mental damage.',
    bestAgainst: ['Sar Bal Gyi (Heavy Armor)', 'War Elephant', 'Shield Guy'],
    weakAgainst: ['Gya Pu (Mental Resolve)', 'A Ba'],
    tacticalTip: 'The ultimate hard-counter to armored behemoths that shrug off physical arrows. Upgrade early when facing Sar Bal Gyi.',
  },
  spear: {
    title: 'Vanguard Pikemen',
    role: 'Cost-Effective Anti-Cavalry',
    description: 'Lances thrust with puncturing precision. Economical tower with low construction cost, making it ideal for budget defense during early draft rounds.',
    bestAgainst: ['Konbaung Cavalry', 'Early Waves'],
    weakAgainst: ['Armored Swarms', 'Air Units'],
    tacticalTip: 'The cheapest tower in the realm. Great for locking down early gold margins or providing auxiliary coverage on split lanes.',
  },
  gun: {
    title: 'Royal Flintlock Sniper',
    role: 'Extreme Range Precision Shot',
    description: 'Imported flintlock musketry wielded by master marksmen. Exceptional range and devastating single-shot impact that snipes priority high-threat targets from afar.',
    bestAgainst: ['War Elephant', 'Say Sayar Healers', 'Doe Pat Drummers'],
    weakAgainst: ['Dense Low-HP Swarms'],
    tacticalTip: 'Prioritizes high-value targets across the entire map. Eliminates enemy healers and drummers before their support auras reach the front.',
  },
  water_cannon: {
    title: 'Thingyan Water Jet',
    role: 'Torrential Hydro Blast',
    description: 'High-pressure festival water cannon that douses oncoming mobs with torrential force, disrupting forward charges and extinguishing incendiary wards.',
    bestAgainst: ['Aggressive Chargers', 'Melee Swarms'],
    weakAgainst: ['Dispersed Air Units'],
    tacticalTip: 'High-utility tower that holds corridors firmly. Combines effectively with area splash damage.',
  },
  chinthe: {
    title: 'Sacred Chinthe Guardian',
    role: 'Mythical Lion Roar Blast',
    description: 'Stone lion sculpted in homage to royal guardian spirits. Channels primordial roar energy into concussive beams that obliterate oncoming invaders.',
    bestAgainst: ['Heavy Assault Waves', 'Spiritual Mobs'],
    weakAgainst: ['Fast Spread Swarms'],
    tacticalTip: 'An imposing centerpiece defense with high tier scaling. Upgrading to Tier 3 delivers monstrous late-game wave clear.',
  },
  dragon: {
    title: 'Pyinnya Dragon Siphon',
    role: 'Incendiary Dragon Breath',
    description: 'Imbued with dragon essence, spewing searing continuous flames. Renders armor brittle and scorches tightly grouped formations over time.',
    bestAgainst: ['Armored Lines', 'Regenerative Units'],
    weakAgainst: ['Long-Range Infiltrators'],
    tacticalTip: 'Place at choke points where enemies march in single file to maximize fire cone penetration.',
  },
  sein_pyaung: {
    title: 'Sein Pyaung Mortar Cannon',
    role: 'Colossal Siege Mortar',
    description: 'The legendary diamond siege mortar of the Konbaung artillery corps. Launches devastating long-range concussive shells that shatter earth and armor.',
    bestAgainst: ['Colossal War Elephants', 'Armored Formations'],
    weakAgainst: ['Ultra-Fast Scout Swarms'],
    tacticalTip: 'Tremendous kinetic energy that vaporizes heavy vanguards. Pair with rapid archers to handle any fast runners that slip past.',
  },
};

export const AlmanacTowersTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(ACTIVE_TOWER_IDS[0]);
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(0);

  const design: TowerDesignConfig = TOWER_DESIGNS[selectedId] || TOWER_DESIGNS.archer;
  const towerType: TowerType = TOWER_TYPES[selectedId] || TOWER_TYPES.archer;
  const tiers = towerType?.tiers || [];
  const currentTier = tiers[selectedTierIndex] || tiers[0] || {
    cost: 50,
    damage: 10,
    damageMax: 14,
    range: 140,
    fireRate: 1,
    projectileSpeed: 400,
  };

  const lore = TOWER_EXTRA_INFO[selectedId] || {
    title: design.name,
    role: 'Defender Tower',
    description: 'Guardian fortification of the Konbaung Dynasty.',
    bestAgainst: ['Standard Infantry'],
    weakAgainst: ['Heavy Armor'],
    tacticalTip: 'Place along defensive pads to protect the base citadel.',
  };

  const damageType = damageTypeOfTower(selectedId);
  const badgeStyle = DAMAGE_BADGE_STYLE[damageType];

  const minDmg = currentTier.damage;
  const maxDmg = currentTier.damageMax ?? currentTier.damage;
  const fireRate = currentTier.fireRate || 1;
  const dpsMin = Math.round(minDmg * fireRate);
  const dpsMax = Math.round(maxDmg * fireRate);
  const attackInterval = (1 / fireRate).toFixed(2);

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-2.5 sm:gap-4 h-full min-h-0 overflow-hidden">
      {/* ──── Desktop Left Column: Tower Cards Gallery ──── */}
      <div className="hidden md:flex w-72 lg:w-80 flex-col shrink-0 bg-slate-950/80 rounded-xl border border-amber-600/40 overflow-hidden shadow-lg">
        <div className="p-3 border-b border-amber-600/30 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200 font-['Almendra',serif]">
              Arsenal of Citadel ({ACTIVE_TOWER_IDS.length} Towers)
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {ACTIVE_TOWER_IDS.map((id) => {
            const d = TOWER_DESIGNS[id];
            const t = TOWER_TYPES[id];
            const isSelected = id === selectedId;
            const tDmgType = damageTypeOfTower(id);
            const tBadge = DAMAGE_BADGE_STYLE[tDmgType];
            const baseCost = t?.tiers?.[0]?.cost ?? 50;

            return (
              <div
                key={id}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedId(id);
                }}
                onMouseEnter={() => soundEffects.playHover()}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)] scale-[1.01]'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-amber-600/40'
                }`}
              >
                {/* Tower Icon */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-950 border border-amber-500/50 shrink-0">
                  <img
                    src={d?.iconPath || d?.texturePath}
                    alt={d?.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 bg-slate-950/90 px-1 text-[9px] font-mono font-bold text-amber-300 rounded-tl">
                    {baseCost}g
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                      {d?.name || id}
                    </h4>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                      style={{
                        color: tBadge.accent,
                        borderColor: `${tBadge.accent}55`,
                        backgroundColor: `${tBadge.accent}15`,
                      }}
                    >
                      {tDmgType === 'mental' ? 'Mental' : 'Physical'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {TOWER_EXTRA_INFO[id]?.role || 'Fortification'}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[9px] text-amber-300/70 font-mono">
                    <span>Range: {t?.tiers?.[0]?.range ?? 120}</span>
                    <span>•</span>
                    <span>DPS: ~{Math.round((t?.tiers?.[0]?.damage ?? 10) * (t?.tiers?.[0]?.fireRate ?? 1))}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──── Mobile Top Horizontal Selector Strip (visible only on mobile) ──── */}
      <div className="flex md:hidden overflow-x-auto gap-2 p-1.5 bg-slate-950/90 rounded-xl border border-amber-600/40 shrink-0 custom-scrollbar">
        {ACTIVE_TOWER_IDS.map((id) => {
          const d = TOWER_DESIGNS[id];
          const t = TOWER_TYPES[id];
          const isSelected = id === selectedId;
          const tDmgType = damageTypeOfTower(id);
          const tBadge = DAMAGE_BADGE_STYLE[tDmgType];
          const baseCost = t?.tiers?.[0]?.cost ?? 50;

          return (
            <button
              key={id}
              onClick={() => {
                soundEffects.playClick();
                setSelectedId(id);
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg shrink-0 cursor-pointer transition-all border text-left ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-950 via-amber-900/60 to-slate-900 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800'
              }`}
            >
              <img
                src={d?.iconPath || d?.texturePath}
                alt={d?.name}
                className="w-8 h-8 rounded-md object-cover border border-amber-500/40 shrink-0"
              />
              <div className="min-w-0">
                <div className={`text-[11px] font-bold truncate max-w-[85px] ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                  {d?.name || id}
                </div>
                <div className="text-[9px] font-mono text-amber-300/80">
                  {baseCost}g • <span style={{ color: tBadge.accent }}>{tDmgType === 'mental' ? 'Mental' : 'Phys'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ──── Right Column: Tower Detail Inspector ──── */}
      <div className="flex-1 flex flex-col bg-slate-950/90 rounded-xl border border-amber-600/50 overflow-hidden shadow-2xl min-h-0">
        {/* Inspector Header */}
        <div className="p-3 sm:p-4 border-b border-amber-600/30 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-slate-950 border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
              <img
                src={design.iconPath || design.texturePath}
                alt={design.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-xl font-black text-amber-200 font-['Almendra',serif] tracking-wide truncate">
                  {design.name}
                </h3>
                <span
                  className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                  style={{
                    color: badgeStyle.accent,
                    borderColor: `${badgeStyle.accent}66`,
                    backgroundColor: `${badgeStyle.accent}20`,
                  }}
                >
                  {damageType === 'mental' ? 'Mental (Armor Piercing)' : 'Physical (Blunted by Armor)'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-400/80 font-serif italic mt-0.5 truncate">
                {lore.title} — <span className="text-slate-300 not-italic font-sans text-[10px] sm:text-[11px]">{lore.role}</span>
              </p>
            </div>
          </div>

          {/* Tier Switcher Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900 p-1 rounded-lg border border-amber-600/40 shrink-0">
            {tiers.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedTierIndex(idx);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  selectedTierIndex === idx
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-md font-black scale-105'
                    : 'text-amber-200/70 hover:text-white hover:bg-slate-800'
                }`}
              >
                Tier {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Inspector Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar">
          {/* Main Primary Combat Stats Grid: 3 rows x 2 columns */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider block font-medium">Gold Cost</span>
              <span className="text-base sm:text-lg font-black text-amber-300 font-mono leading-tight">{currentTier.cost}g</span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Total Cost</span>
            </div>

            <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider block font-medium">Damage</span>
              <span className="text-base sm:text-lg font-black text-white font-mono leading-tight">
                {minDmg}{maxDmg !== minDmg ? ` - ${maxDmg}` : ''}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Per Shot</span>
            </div>

            <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider block font-medium">DPS</span>
              <span className="text-base sm:text-lg font-black text-emerald-400 font-mono leading-tight">
                ~{dpsMin}{dpsMax !== dpsMin ? ` - ${dpsMax}` : ''}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Effective DPS</span>
            </div>

            <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider block font-medium">Range</span>
              <span className="text-base sm:text-lg font-black text-amber-200 font-mono leading-tight">{currentTier.range} px</span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Firing Radius</span>
            </div>

            <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider block font-medium">Cadence</span>
              <span className="text-base sm:text-lg font-black text-amber-200 font-mono leading-tight">{attackInterval}s</span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">{fireRate.toFixed(2)}/s</span>
            </div>

            <div className="bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider block font-medium">Channel</span>
              <span className="text-base sm:text-lg font-black text-amber-200 font-mono capitalize truncate leading-tight">{damageType}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">
                {damageType === 'mental' ? 'Pierces Armor' : 'Blunted by Armor'}
              </span>
            </div>
          </div>

          {/* Tier Abilities & Special Modifiers (Immediate View Under Stats) */}
          <div className="p-3 bg-amber-950/40 rounded-lg border border-amber-600/50 flex flex-col gap-1.5 shadow-inner">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded border border-amber-600/60 font-mono">
                Tier {selectedTierIndex + 1} Ability & Modifiers
              </span>
              {towerType.attackMode === 'aoe_pulse' && (
                <span className="text-[10px] text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-600/60">
                  360° Shockwave Pulse
                </span>
              )}
              {towerType.splashRadius && (
                <span className="text-[10px] text-orange-300 font-bold bg-orange-950/60 px-2 py-0.5 rounded border border-orange-600/60">
                  AoE Splash ({towerType.splashRadius}px)
                </span>
              )}
              {towerType.armorPenetration && (
                <span className="text-[10px] text-yellow-300 font-bold bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-600/60">
                  Armor Piercing ({Math.round(towerType.armorPenetration * 100)}%)
                </span>
              )}
              {towerType.onHitEffect?.type === 'slow' && (
                <span className="text-[10px] text-blue-300 font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-600/60">
                  Slow ({Math.round(towerType.onHitEffect.magnitude * 100)}%, {towerType.onHitEffect.durationSec}s)
                </span>
              )}
            </div>

            <div className="text-xs text-slate-200 leading-relaxed">
              {currentTier.special?.multiTargets !== undefined && (
                <p>
                  <strong className="text-amber-300">Multi-Shot Volley:</strong> Concurrently targets and fires arrows at up to <strong>{currentTier.special.multiTargets}</strong> enemies simultaneously, shredding oncoming swarms.
                </p>
              )}
              {currentTier.special?.salvoCount !== undefined && (
                <p>
                  <strong className="text-amber-300">Magazine Salvo Burst:</strong> Rapidly discharges <strong>{currentTier.special.salvoCount} bolts</strong> in rapid sequence before reloading. Connecting the final bolt deals <strong>+{currentTier.special.salvoFinisherBonus ?? 0} finisher bonus damage</strong> and <strong>stuns the target for {currentTier.special.salvoFinisherStunSec ?? 1.0}s</strong>.
                </p>
              )}
              {currentTier.special?.windupMaxBonus !== undefined && (
                <p>
                  <strong className="text-amber-300">Ramping Windup:</strong> Consecutive shots build +10% fire rate stacks up to <strong>+{Math.round(currentTier.special.windupMaxBonus * 100)}%</strong> max attack speed. Decays to 0 if idle for more than 2.0s.
                </p>
              )}
              {currentTier.special?.armorPierceRatio !== undefined && (
                <p>
                  <strong className="text-amber-300">Armor Piercing:</strong> High-explosive splash ignores <strong>{Math.round(currentTier.special.armorPierceRatio * 100)}%</strong> of target physical armor.
                </p>
              )}
              {selectedId === 'bomb' && currentTier.special?.knockbackPx !== undefined && (
                <p>
                  <strong className="text-amber-300">Demolition Concussion:</strong> Direct hits and concussive blasts knock targets backward along the path by <strong>{currentTier.special.knockbackPx}px</strong>.
                </p>
              )}
              {currentTier.special?.pulseSlow !== undefined && (
                <p>
                  <strong className="text-amber-300">Echoing Terror:</strong> Sonic pulse inflicts a <strong>{Math.round(currentTier.special.pulseSlow * 100)}%</strong> slow on all mobs in radius for 1.5s.
                </p>
              )}
              {currentTier.special?.bleedTotalDamage !== undefined && (
                <p>
                  <strong className="text-amber-300">Lacerating Bleed:</strong> Fast piercing thrusts inflict physical bleed dealing <strong>{currentTier.special.bleedTotalDamage}</strong> total bleed damage over 3.0s.
                </p>
              )}
              {currentTier.special?.prioritizeSupport && (
                <p>
                  <strong className="text-amber-300">Bounty Hunter:</strong> Prioritizes high-value support casters (Healers, Drummers). Awards <strong>+{currentTier.special.bonusGoldOnKill}g</strong> bonus gold on kill.
                </p>
              )}
              {currentTier.special?.drenchSlow !== undefined && (
                <p>
                  <strong className="text-amber-300">Drench & Soak:</strong> Drenches struck enemies for 2.5s, applying a <strong>{Math.round(currentTier.special.drenchSlow * 100)}%</strong> slow and amplifying incoming mental damage by <strong>+{Math.round((currentTier.special.drenchVulnerability ?? 0) * 100)}%</strong>.
                </p>
              )}
              {currentTier.special?.silenceSec !== undefined && (
                <p>
                  <strong className="text-amber-300">Temple Gatekeeper:</strong> Sacred roar knocks targets backward by <strong>{currentTier.special.knockbackPx ?? 0}px</strong> and silences active mob auras and abilities for <strong>{currentTier.special.silenceSec}s</strong>.
                </p>
              )}
              {currentTier.special?.deathExplosionDamage !== undefined && (
                <p>
                  <strong className="text-amber-300">Cataclysmic Detonation:</strong> When an enemy is slain by dragon fire, they detonate in an AoE explosion of spiritual flame dealing <strong>{currentTier.special.deathExplosionDamage}</strong> mental damage within a <strong>{currentTier.special.deathExplosionRadius ?? 50}px</strong> blast radius.
                </p>
              )}
              {currentTier.special?.armorStripPermanent !== undefined && (
                <p>
                  <strong className="text-amber-300">Armor Crushing:</strong> Heavy kinetic shells permanently strip <strong>{currentTier.special.armorStripPermanent}</strong> physical armor from the target per hit.
                </p>
              )}
              {!currentTier.special && !towerType.splashRadius && !towerType.onHitEffect && !towerType.attackMode && !towerType.armorPenetration && (
                <p className="text-slate-300 italic">
                  Standard baseline attack mode. Upgrade to higher tiers to unlock specialized tactical combat abilities.
                </p>
              )}
            </div>
          </div>

          {/* Lore & Historical Context */}
          <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1 font-['Almendra',serif]">
              Historical Chronicle & Lore
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-serif">
              "{lore.description}"
            </p>
          </div>

          {/* Tactical Advice & Counters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-800/40">
              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5">
                Dominates / Counters
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {lore.bestAgainst.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold font-mono">+</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-rose-950/20 p-3 rounded-lg border border-rose-800/40">
              <div className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-1.5">
                Vulnerable Against
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {lore.weakAgainst.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-rose-400 font-bold font-mono">-</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Commander's Tip */}
          <div className="p-3 bg-slate-900/90 rounded-lg border border-amber-500/40 flex items-start gap-2.5">
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-amber-300">Commander's Field Note: </span>
              <span className="text-slate-300">{lore.tacticalTip}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
