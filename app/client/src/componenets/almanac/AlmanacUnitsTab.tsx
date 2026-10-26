import React, { useState } from 'react';
import { MOB_TYPES, type MobType } from '@root/shared';
import { soundEffects } from '../../audio/soundEffects';

interface UnitVisualAndLore {
  faceUrl: string;
  sheetUrl: string;
  role: string;
  title: string;
  description: string;
  tacticalTip: string;
  bestPairedWith: string[];
  counteredBy: string[];
}

const UNIT_EXTRA_DATA: Record<string, UnitVisualAndLore> = {
  monkey: {
    faceUrl: '/assets/units/monkey/face.jpg',
    sheetUrl: '/assets/units/monkey/spritesheet.png',
    role: 'Burst-Speed Swarmer & Economy Builder',
    title: 'Forest Scavenger',
    description: 'Agile simian raiders that bolt out of the gates with an initial 130 Burst of Speed! Once struck by any tower damage, they drop down to an average 65 movement speed.',
    tacticalTip: 'Pair with a Shield Bearer in front to soak hits so Monkeys maintain their 130 sprint speed much deeper into the lane!',
    bestPairedWith: ['Shield Bearer (to preserve burst speed)', 'Doe Pat Drummer (for supersonic rush)'],
    counteredBy: ['Bell Tower (AoE strips burst speed early)', 'Archer Tower (rapid fire)'],
  },
  horse_rider: {
    faceUrl: '/assets/units/horse_rider/face.jpg',
    sheetUrl: '/assets/units/horse_rider/spritesheet.png',
    role: 'Light Armored Shock Cavalry',
    title: 'Konbaung Royal Cavalry',
    description: 'Armored horsemen charging along treacherous mountain passes. Shrugs off light physical arrows while crossing intermediate lanes swiftly.',
    tacticalTip: 'Strong mid-game pressure unit. Their base 2 armor blunts low-caliber archer towers, forcing defenders to spend on heavier cannons.',
    bestPairedWith: ['Doe Pat Drummer', 'Monkey (distraction)'],
    counteredBy: ['Spear Tower (anti-cavalry)', 'Cannon (slow)'],
  },
  sar_bal_gyi: {
    faceUrl: '/assets/units/sar_bal_gyi/face.jpg',
    sheetUrl: '/assets/units/sar_bal_gyi/spritesheet.png',
    role: 'Heavy Armored Citadel Juggernaut',
    title: 'Palace Royal Guard',
    description: 'Elite royal infantry clad in layered bronze and lacquered steel. Possesses an extraordinary 8 physical armor, rendering standard arrows virtually useless.',
    tacticalTip: 'Completely impervious to light physical volleys. However, they have 0 mental strength, making them extremely susceptible to the Bell Tower.',
    bestPairedWith: ['Say Sayar (continuous healing)', 'Doe Pat (countering slow movement)'],
    counteredBy: ['Bell Tower (mental pulse)', 'High-Tier Gun Tower'],
  },
  gya_pu: {
    faceUrl: '/assets/units/gya_pu/face.jpg',
    sheetUrl: '/assets/units/gya_pu/spritesheet.png',
    role: 'Spiritual Winged Nat',
    title: 'Winged Nat Spirit',
    description: 'Ethereal celestial spirit soaring gracefully above obstacles. Imbued with maximum 1.0 Mental Strength, completely resisting mental crack and terror.',
    tacticalTip: 'The definitive hard-counter to the Bell Tower and spiritual defenses. Send them when the defender over-invests in mental damage.',
    bestPairedWith: ['Horse Rider', 'Sar Bal Gyi'],
    counteredBy: ['Archer Tower', 'Gun Tower Sniper'],
  },
  a_ba: {
    faceUrl: '/assets/units/a_ba/face.jpg',
    sheetUrl: '/assets/units/a_ba/spritesheet.png',
    role: 'Accelerating Nat Medium',
    title: 'Spirit Medium (A-Ba)',
    description: 'Revered shaman communing with the 37 Nats. Starts at a steady 45 speed and continuously accelerates as he progresses along the path, reaching 2x speed (90) after 25 seconds.',
    tacticalTip: 'Ideal for long winding lanes! Combine with full mental immunity (100% Mental Strength) to race through late-lane defenses.',
    bestPairedWith: ['Say Sayar (keeps him alive during ramp)', 'Shield Bearer'],
    counteredBy: ['Front-Loaded Physical Burst', 'Gun Tower'],
  },
  chon_toe: {
    faceUrl: '/assets/units/chon_toe/face.jpg',
    sheetUrl: '/assets/units/chon_toe/spritesheet.png',
    role: 'Stealth Bruiser & Line Breaker',
    title: 'Bush Sneak (Chon-Toe)',
    description: 'Cunning ambusher from the teak jungle. Boasts massive 750 HP and 4 armor, designed to absorb heavy frontline punishment.',
    tacticalTip: 'High health and solid armor make Chon-Toe ideal for leading major wave pushes during mid-to-late combat phases.',
    bestPairedWith: ['Say Sayar Healer', 'War Elephant'],
    counteredBy: ['Bell Tower Pulse', 'Tier 3 Bomb Tower'],
  },
  elephant_rider: {
    faceUrl: '/assets/units/elephant_rider/face.jpg',
    sheetUrl: '/assets/units/elephant_rider/elephant_rider.png',
    role: 'Colossal Siege War Beast',
    title: 'Imperial War Elephant',
    description: 'The crowning terror of the battlefield. 1,300 HP and a staggering 10 Armor. If an elephant breaches the royal citadel gates, it inflicts a crushing 10 Leak Damage!',
    tacticalTip: 'The game-ender. When supported by healers and taunt defenders, an elephant push forces the defender into desperate countermeasures.',
    bestPairedWith: ['Shield Bearer (Taunt)', 'Say Sayar (Heal)', 'Doe Pat (Speed)'],
    counteredBy: ['Bell Tower (ignores armor)', 'High-Tier Sein Pyaung Mortar'],
  },
  say_sayar: {
    faceUrl: '/assets/units/say_sayar/face.jpg',
    sheetUrl: '/assets/units/say_sayar/say_sayar.png',
    role: 'Aura Combat Healer',
    title: 'Royal Herbalist Physician',
    description: 'Master of ancient Burmese medicinal remedies. Emits a rejuvenating Heal Aura in a 140px radius every 6 seconds, restoring 80 HP to all injured allies.',
    tacticalTip: 'Position behind high-HP tanks like Sar Bal Gyi or War Elephants. Keeps your vanguard alive through intense tower gauntlets.',
    bestPairedWith: ['Shield Bearer', 'War Elephant', 'Sar Bal Gyi'],
    counteredBy: ['Gun Tower Sniper (assassinates high-value support from afar)'],
  },
  shield_guy: {
    faceUrl: '/assets/units/shield_guy/face.jpg',
    sheetUrl: '/assets/units/shield_guy/shield_guy.png',
    role: 'Taunting Vanguard Defender',
    title: 'Vanguard Shield Bearer',
    description: 'Armed with an impenetrable spiked pavise shield. Employs a battle roar Taunt that forces EVERY tower in range to prioritize attacking him first.',
    tacticalTip: 'Essential vanguard leader. Deploy right in front of fragile damage-dealers or healers to redirect all incoming projectiles away from them.',
    bestPairedWith: ['Say Sayar (heals the shield)', 'Monkey Swarms (slip through unhindered)'],
    counteredBy: ['Bell Tower (AoE pulses ignore taunt redirect and hit all mobs)'],
  },
  doe_pat: {
    faceUrl: '/assets/units/doe_pat/face.jpg',
    sheetUrl: '/assets/units/doe_pat/sheet.png',
    role: 'Haste War Drummer',
    title: 'Doe Pat War Drummer',
    description: 'Traditional folk drummer beating rhythmic martial rhythms. Grants a massive +40% Speed Boost Aura to all nearby units for 4 seconds.',
    tacticalTip: 'Accelerates slow behemoths like Sar Bal Gyi and War Elephants past dangerous choke points before towers can finish them.',
    bestPairedWith: ['Sar Bal Gyi', 'War Elephant', 'Horse Rider'],
    counteredBy: ['Cannon (slow counteracts speed)', 'Gun Tower (picks off drummer)'],
  },
  bandit: {
    faceUrl: '/assets/units/Bandit/face.png',
    sheetUrl: '/assets/units/Bandit/spritesheet.png',
    role: 'Swift Raider & Outlaw Vanguard',
    title: 'Bandit Raider',
    description: 'Ruthless woodland plunderers roaming between provinces. Bolstered by light armor and rapid movement, bandits charge past sluggish defenses to breach outer barriers.',
    tacticalTip: 'High-speed infiltration unit with a touch of physical armor. Ideal for overwhelming towers when deployed alongside simian swarms.',
    bestPairedWith: ['Monkey (swarming)', 'Doe Pat Drummer (blistering sprint)'],
    counteredBy: ['Archer Tower (rapid arrows)', 'Cannon (splash stagger)'],
  },
  belu: {
    faceUrl: '/assets/units/Belu/face.jpg',
    sheetUrl: '/assets/units/Belu/spritesheet.png',
    role: 'Adaptive Mythical Ogre Behemoth',
    title: 'Belu Ogre',
    description: 'Fearsome horned ogre with 950 HP that starts at 0 Armor and 0% Mental Strength, but adapts whenever hit (up to 5 total stacks): up to 12 Armor at 5 physical hits or 100% Mental Strength at 5 mental hits.',
    tacticalTip: 'Punishes mono-damage defense lines! Defenders must mix physical and mental towers carefully or bait his 5 adaptive stacks early.',
    bestPairedWith: ['Say Sayar (massive HP pool healing)', 'Doe Pat Drummer (overcoming slow stride)'],
    counteredBy: ['Mixed Physical + Mental Defense', 'Sein Pyaung Mortar (high single-hit burst)'],
  },
  brute: {
    faceUrl: '/assets/units/Brute/face.png',
    sheetUrl: '/assets/units/Brute/spritesheet.png',
    role: 'Self-Regenerating Shock Bruiser',
    title: 'Heavy Brute',
    description: 'Resilient bandit enforcer with 460 HP and 4 armor who regenerates 10% of his maximum health every 10 seconds whenever injured.',
    tacticalTip: 'Excels against chip damage and spread-out defenses where his 10-second self-heal can trigger multiple times down the lane.',
    bestPairedWith: ['Bandit Raider (follow-up surge)', 'Say Sayar Physician'],
    counteredBy: ['Bell Tower (low mental resolve)', 'Concentrated Single-Target Burst'],
  },
  general: {
    faceUrl: '/assets/units/General/face.jpg',
    sheetUrl: '/assets/units/General/spritesheet.png',
    role: 'Elite Royal Bo Commander',
    title: 'Royal Bo General',
    description: 'Venerated battlefield warlord marching under the royal peacock standard. Combines 6 heavy armor with an exceptional 90% mental resolve to lead relentless assaults.',
    tacticalTip: 'Well-rounded commander with high survivability against both physical and mental assaults. Forces defense lines into multi-tower commitments.',
    bestPairedWith: ['Shield Bearer (taunt protection)', 'War Elephant', 'Say Sayar'],
    counteredBy: ['Concentrated Single-Target Burst', 'Water Cannon (slowing advance)'],
  },
  sone_ma: {
    faceUrl: '/assets/units/SoneMa/face.jpg',
    sheetUrl: '/assets/units/SoneMa/spritesheet.png',
    role: 'Occult Hex Sorceress',
    title: 'Sone Ma Sorceress',
    description: 'Mystical practitioner of ancient occult arts. Possesses 100% Mental Strength and unleashes a Dying Hex when slain, stunning the tower that killed her for 5 seconds!',
    tacticalTip: 'Send Sone Ma ahead of your main wave so a high-value defender tower kills her and gets stunned for 5 full seconds while your heavy units march past!',
    bestPairedWith: ['War Elephant (capitalizes on stunned tower)', 'Belu Ogre'],
    counteredBy: ['Low-cost Archer Tower (baits the death stun away from heavy towers)'],
  },
};

const UNIT_IDS = [
  'monkey',
  'horse_rider',
  'sar_bal_gyi',
  'gya_pu',
  'a_ba',
  'chon_toe',
  'elephant_rider',
  'say_sayar',
  'shield_guy',
  'doe_pat',
  'bandit',
  'belu',
  'brute',
  'general',
  'sone_ma',
];

export const AlmanacUnitsTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(UNIT_IDS[0]);

  const mob: MobType = MOB_TYPES[selectedId] || MOB_TYPES.monkey;
  const info = UNIT_EXTRA_DATA[selectedId] || UNIT_EXTRA_DATA.monkey;

  const speedTier = mob.speed >= 100 ? 'Very Fast' : mob.speed >= 60 ? 'Fast' : mob.speed >= 40 ? 'Moderate' : 'Slow';
  const speedTierColor = mob.speed >= 100 ? 'text-amber-400' : mob.speed >= 60 ? 'text-emerald-400' : 'text-slate-300';

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 h-full min-h-0 overflow-hidden">
      {/* ──── Left Column: Unit Gallery ──── */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col shrink-0 bg-slate-950/80 rounded-xl border border-amber-600/40 overflow-hidden shadow-lg">
        <div className="p-3 border-b border-amber-600/30 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200 font-['Almendra',serif]">
              Invading Host ({UNIT_IDS.length} Units)
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {UNIT_IDS.map((id) => {
            const m = MOB_TYPES[id];
            const meta = UNIT_EXTRA_DATA[id];
            const isSelected = id === selectedId;

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
                {/* Face Icon */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-950 border border-amber-500/50 shrink-0">
                  <img
                    src={meta?.faceUrl}
                    alt={m?.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 bg-slate-950/90 px-1 text-[9px] font-mono font-bold text-amber-300 rounded-tl">
                    {m?.cost}g
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                      {m?.name || id}
                    </h4>
                    {m?.taunt && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-950 border border-red-500/60 text-red-300">
                        Taunt
                      </span>
                    )}
                    {m?.ability?.type === 'heal_aura' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/60 text-emerald-300">
                        Healer
                      </span>
                    )}
                    {m?.ability?.type === 'self_heal' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/60 text-emerald-300">
                        Self-Heal
                      </span>
                    )}
                    {m?.ability?.type === 'speed_aura' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-yellow-950 border border-yellow-500/60 text-yellow-300">
                        Drummer
                      </span>
                    )}
                    {m?.speedRamp && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-950 border border-sky-500/60 text-sky-300">
                        Ramp
                      </span>
                    )}
                    {m?.adaptiveDefense && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/60 text-purple-300">
                        Adaptive
                      </span>
                    )}
                    {m?.damagedSpeed !== undefined && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/60 text-amber-300">
                        Burst
                      </span>
                    )}
                    {m?.onDeathTowerStunSec && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-fuchsia-950 border border-fuchsia-500/60 text-fuchsia-300">
                        Hex Stun
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {meta?.role || 'Attacker Unit'}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[9px] text-amber-300/70 font-mono">
                    <span>HP: {m?.maxHp}</span>
                    <span>•</span>
                    <span>Armor: {m?.armor}</span>
                    <span>•</span>
                    <span>Spd: {m?.speed}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──── Right Column: Unit Detail Inspector ──── */}
      <div className="flex-1 flex flex-col bg-slate-950/90 rounded-xl border border-amber-600/50 overflow-hidden shadow-2xl min-h-0">
        {/* Inspector Header */}
        <div className="p-3.5 sm:p-4 border-b border-amber-600/30 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
              <img
                src={info.faceUrl}
                alt={mob.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-xl font-black text-amber-200 font-['Almendra',serif] tracking-wide">
                    {mob.name}
                  </h3>
                  {mob.nickname && (
                    <span className="text-xs font-serif italic text-amber-400 font-normal">
                      "{mob.nickname}"
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-950/40 text-amber-300">
                  Cost: {mob.cost} Gold
                </span>
              </div>
              <p className="text-xs text-amber-400/80 font-serif italic mt-0.5">
                {info.title} — <span className="text-slate-300 not-italic font-sans text-[11px]">{info.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Leak Penalty:</span>
            <span className="text-xs font-black px-2 py-1 bg-red-950/80 border border-red-500/60 rounded text-red-200 font-mono">
              -{mob.leakDamage} Palace HP
            </span>
          </div>
        </div>

        {/* Inspector Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Visual Presentation + Core Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Unit Face / Portrait Stage */}
            <div className="lg:col-span-4 bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl border border-amber-600/30 p-4 flex flex-col items-center justify-center relative min-h-[170px]">
              <div className="absolute inset-0 bg-radial-at-c from-amber-500/10 via-transparent to-transparent pointer-events-none" />
              <img
                src={info.faceUrl}
                alt={mob.name}
                className="w-28 h-28 rounded-xl object-cover border-2 border-amber-400/60 shadow-[0_8px_20px_rgba(0,0,0,0.8)] z-10"
              />
              <span className="text-[11px] text-amber-300 font-mono mt-2 z-10">
                Speed: <strong className={speedTierColor}>{speedTier} ({mob.speed})</strong>
              </span>
            </div>

            {/* Combat Gauges */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Health (HP)</span>
                <span className="text-base font-black text-rose-400 font-mono">{mob.maxHp} HP</span>
                <span className="text-[9px] text-slate-500 block">Total hit points</span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Physical Armor</span>
                <span className="text-base font-black text-blue-300 font-mono">
                  {(mob.armor ?? 0) > 0 ? `${mob.armor} Armor` : '0 (None)'}
                </span>
                <span className="text-[9px] text-slate-500 block">Blunts physical arrows</span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Mental Strength</span>
                <span className="text-base font-black text-purple-300 font-mono">
                  {((mob.mentalStrength ?? 0.5) * 100).toFixed(0)}% Resolve
                </span>
                <span className="text-[9px] text-slate-500 block">Resists Bell pulse crack</span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Deployment Cost</span>
                <span className="text-base font-black text-amber-300 font-mono">{mob.cost} Gold</span>
                <span className="text-[9px] text-slate-500 block">Attacker investment</span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Defender Bounty</span>
                <span className="text-base font-black text-yellow-400 font-mono">+{mob.bounty} Gold</span>
                <span className="text-[9px] text-slate-500 block">Reward when slain</span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Leak Damage</span>
                <span className="text-base font-black text-red-400 font-mono">-{mob.leakDamage} Core HP</span>
                <span className="text-[9px] text-slate-500 block">On reaching palace</span>
              </div>
            </div>
          </div>

          {/* Unique Special Ability Banner */}
          {(mob.ability || mob.taunt || mob.speedRamp || mob.adaptiveDefense || mob.damagedSpeed !== undefined || mob.onDeathTowerStunSec) && (
            <div className="p-3.5 bg-gradient-to-r from-amber-950/40 to-slate-900 rounded-lg border border-amber-500/50 flex items-start gap-3">
              <div className="text-xs">
                <h5 className="font-bold text-amber-300 uppercase tracking-wide">
                  Active Battlefield Ability:
                </h5>
                {mob.taunt && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Royal Taunt:</strong> Emits an authoritative challenge that overrides tower targeting.
                    Every tower in range is forced to attack this unit before any other targets!
                  </p>
                )}
                {mob.ability?.type === 'heal_aura' && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Herbalist Healing Aura:</strong> Emits an emerald aura in a <strong>{mob.ability.radius}px</strong> radius
                    every <strong>{mob.ability.cooldownSec}s</strong>, restoring <strong>{mob.ability.healAmount} HP</strong> to all injured comrades below 50% health!
                  </p>
                )}
                {mob.ability?.type === 'self_heal' && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Battlefield Second Wind:</strong> Regenerates <strong>{Math.round((mob.ability.healFraction || 0.1) * 100)}% of Max HP ({Math.round(mob.maxHp * (mob.ability.healFraction || 0.1))} HP)</strong> every <strong>{mob.ability.cooldownSec}s</strong> whenever injured!
                  </p>
                )}
                {mob.ability?.type === 'speed_aura' && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Martial War Drums:</strong> Beats resonant drums in a <strong>{mob.ability.radius}px</strong> radius,
                    granting a massive <strong>+{Math.round((mob.ability.speedBoost || 0.4) * 100)}% Speed Boost</strong> to all nearby allies for {mob.ability.durationSec}s!
                  </p>
                )}
                {mob.speedRamp && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Spiritual Momentum:</strong> Starts at <strong>{mob.speed} speed</strong> and continuously accelerates along the lane, reaching <strong>{(1 + mob.speedRamp.maxBonusFraction)}x speed ({Math.round(mob.speed * (1 + mob.speedRamp.maxBonusFraction))})</strong> after <strong>{mob.speedRamp.rampDurationSec}s</strong>!
                  </p>
                )}
                {mob.adaptiveDefense && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Adaptive Carapace (Max {mob.adaptiveDefense.maxStacks} Stacks):</strong> Each physical hit grants <strong>+{mob.adaptiveDefense.armorPerStack} Armor</strong> (up to {Math.round(mob.adaptiveDefense.armorPerStack * mob.adaptiveDefense.maxStacks)} Armor at {mob.adaptiveDefense.maxStacks} stacks), while each mental hit grants <strong>+{Math.round(mob.adaptiveDefense.mentalStrengthPerStack * 100)}% Mental Strength</strong> (up to {Math.round(mob.adaptiveDefense.mentalStrengthPerStack * mob.adaptiveDefense.maxStacks * 100)}% at {mob.adaptiveDefense.maxStacks} stacks).
                  </p>
                )}
                {mob.damagedSpeed !== undefined && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Burst of Speed:</strong> Bolts down the lane at <strong>{mob.speed} speed</strong> until taking damage from a tower for the first time, after which movement speed permanently drops to <strong>{mob.damagedSpeed}</strong>.
                  </p>
                )}
                {mob.onDeathTowerStunSec && (
                  <p className="text-slate-200 mt-1 leading-relaxed">
                    <strong>Dying Hex:</strong> Upon death, curses the tower that dealt the killing blow, <strong>stunning it for {mob.onDeathTowerStunSec} seconds</strong>!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Lore & Background */}
          <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1 font-['Almendra',serif]">
              Origin & Vanguard Chronicle
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-serif">
              "{info.description}"
            </p>
          </div>

          {/* Tactical Synergies and Counters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-800/40">
              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5">
                Best Wave Combos
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {info.bestPairedWith.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold font-mono">+</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-rose-950/20 p-3 rounded-lg border border-rose-800/40">
              <div className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-1.5">
                Hard Tower Counters
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {info.counteredBy.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-rose-400 font-bold font-mono">-</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Field Note */}
          <div className="p-3 bg-slate-900/90 rounded-lg border border-amber-500/40 flex items-start gap-2.5">
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-amber-300">Warlord's Strategy: </span>
              <span className="text-slate-300">{info.tacticalTip}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
