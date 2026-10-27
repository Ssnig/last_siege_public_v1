import React, { useState } from 'react';
import { soundEffects } from '../../audio/soundEffects';

export const DefenderTutorial: React.FC = () => {
  const [activeModule, setActiveModule] = useState<number>(1);

  // Module 1 State: Pad Placement Simulator
  const [placedPads, setPlacedPads] = useState<Record<string, string>>({});
  const [goldM1, setGoldM1] = useState<number>(350);

  // Module 2 State: Damage Channel Simulator
  const [m2TargetHp, setM2TargetHp] = useState<number>(420);
  const [m2CrackActive, setM2CrackActive] = useState<boolean>(false);
  const [m2CombatLog, setM2CombatLog] = useState<string[]>([]);

  // Module 3 State: Upgrade Simulator
  const [m3Tier, setM3Tier] = useState<number>(1);
  const [m3Sold, setM3Sold] = useState<boolean>(false);

  // Module 4 State: Aggro & CC Simulator
  const [m4TauntActive, setM4TauntActive] = useState<boolean>(false);
  const [m4SlowActive, setM4SlowActive] = useState<boolean>(false);

  // Quiz State
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  // Handlers for Module 1
  const handlePlaceTower = (padId: string, towerType: 'archer' | 'cannon') => {
    soundEffects.playClick();
    const cost = towerType === 'archer' ? 55 : 140;
    if (goldM1 >= cost && !placedPads[padId]) {
      setPlacedPads((prev) => ({ ...prev, [padId]: towerType }));
      setGoldM1((prev) => prev - cost);
    }
  };

  const handleClearPads = () => {
    soundEffects.playClick();
    setPlacedPads({});
    setGoldM1(350);
  };

  // Handlers for Module 2: Test Damage against 8-Armor Palace Royal Guard
  const handleAttackM2 = (weapon: 'archer' | 'spear' | 'bell') => {
    soundEffects.playClick();
    let dmg = 0;
    let desc = '';
    const armor = 8;

    if (weapon === 'archer') {
      soundEffects.playTowerShootAudition('archer');
      // 10 physical dmg - 8 armor = 2 dmg
      dmg = Math.max(0, 10 - armor);
      desc = `🏹 Archer (10 Phys Dmg) vs 8 Armor = ${dmg} damage dealt! (Blunted by armor!)`;
    } else if (weapon === 'spear') {
      soundEffects.playTowerShootAudition('spear');
      // 8 physical dmg with 50% armor pen -> 8 - 4 = 4 dmg
      const effArmor = armor * 0.5;
      dmg = Math.max(0, 8 - effArmor);
      desc = `🔱 Spear (8 Phys Dmg with 50% Armor Pierce) vs 4 Effective Armor = ${dmg} damage dealt!`;
    } else if (weapon === 'bell') {
      soundEffects.playTowerShootAudition('bell');
      // 12 mental dmg, completely ignores armor!
      // If already cracked, mental damage is amplified to 2x (24)
      const multiplier = m2CrackActive ? 2.0 : 1.0;
      dmg = Math.round(12 * multiplier);
      desc = m2CrackActive
        ? `🔔 Bell Tower: AMPLIFIED CRACK! Ignores 8 Armor completely -> deals ${dmg} damage (2x amplified)!`
        : `🔔 Bell Tower: Ignores 8 Armor completely -> deals ${dmg} damage and CRACKS the mob's resolve!`;
      setM2CrackActive(true);
    }

    setM2TargetHp((prev) => Math.max(0, prev - dmg));
    setM2CombatLog((prev) => [desc, ...prev.slice(0, 4)]);
  };

  const handleResetM2 = () => {
    soundEffects.playClick();
    setM2TargetHp(420);
    setM2CrackActive(false);
    setM2CombatLog([]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950/80 rounded-xl border border-amber-600/40 shadow-2xl overflow-hidden">
      {/* Top Module Navigation Bar */}
      <div className="p-3 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border-b border-amber-600/30 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <div>
            <h3 className="text-base sm:text-lg font-black text-amber-200 font-['Almendra',serif] tracking-wide">
              DEFENDER ACADEMY — THE ROYAL CITADEL
            </h3>
            <p className="text-[11px] text-amber-300/70 italic font-serif">
              Master fortress placement, dual damage channels, upgrade economies, and crowd control.
            </p>
          </div>
        </div>

        {/* Module Steps (1..4) */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((num) => (
            <button
              key={num}
              onClick={() => {
                soundEffects.playClick();
                setActiveModule(num);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeModule === num
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'bg-slate-900/90 text-amber-200/70 border border-amber-700/40 hover:bg-slate-800'
              }`}
            >
              <span>Module {num}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Module Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
        {/* ========================================================================= */}
        {/* MODULE 1: CONSTRUCTION & CHOKE POINTS */}
        {/* ========================================================================= */}
        {activeModule === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-600/30">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Lesson 1 of 4: Placement Strategy
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                Stone Slot Construction & Choke Points
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Towers can only be constructed on dedicated <strong>Stone Pads</strong> along the path. As the Defender,
                you begin each match with <strong>350 Starting Gold</strong>. Placing towers on <strong>corners, bends, and intersections</strong> allows them to attack enemies for more than double the duration of a straight corridor!
              </p>
            </div>

            {/* Interactive Placement Simulator */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-300">Remaining Gold:</span>
                  <span className="text-sm font-mono font-black text-amber-200 px-2 py-0.5 rounded bg-black/60 border border-amber-500/40">
                    💰 {goldM1}g
                  </span>
                </div>
                <button
                  onClick={handleClearPads}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition"
                >
                  Reset Board
                </button>
              </div>

              {/* Simplified Lane Layout with 3 Stone Pads */}
              <div className="relative h-44 bg-[#1f1510] rounded-xl border-2 border-[#8a661b] p-3 overflow-hidden flex flex-col justify-between">
                {/* Visual Lane Curve */}
                <div className="absolute top-1/2 left-0 right-0 h-10 -translate-y-1/2 bg-[#3d2c1d] border-y-2 border-[#6d4e2d] flex items-center justify-around pointer-events-none opacity-80">
                  <span className="text-[10px] text-amber-500/40 font-mono tracking-widest uppercase">
                    ← Spawn Portal (Enemy Path)
                  </span>
                  <span className="text-[10px] text-amber-500/40 font-mono tracking-widest uppercase">
                    Palace Core →
                  </span>
                </div>

                {/* 3 Interactive Pads */}
                <div className="relative z-10 flex items-center justify-around h-full">
                  {[
                    { id: 'pad-1', label: 'Choke Bend #1', tip: 'High Value (Curve)' },
                    { id: 'pad-2', label: 'Straight Run #2', tip: 'Mid Value' },
                    { id: 'pad-3', label: 'Palace Gate #3', tip: 'Last Stand' },
                  ].map((pad) => {
                    const tower = placedPads[pad.id];
                    return (
                      <div
                        key={pad.id}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className={`w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center p-1.5 transition ${
                            tower
                              ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                              : 'bg-black/60 border-dashed border-amber-600/60 hover:border-amber-400'
                          }`}
                        >
                          {tower ? (
                            <div className="flex flex-col items-center text-center">
                              <span className="text-2xl">{tower === 'archer' ? '🏹' : '💥'}</span>
                              <span className="text-[10px] font-bold text-amber-200 capitalize mt-0.5">
                                {tower}
                              </span>
                              <span className="text-[8px] text-emerald-400 font-mono">ACTIVE</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] text-amber-300 font-bold">{pad.label}</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handlePlaceTower(pad.id, 'archer')}
                                  disabled={goldM1 < 55}
                                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-900 hover:bg-emerald-800 text-emerald-200 disabled:opacity-30 cursor-pointer"
                                  title="Build Archer (55g)"
                                >
                                  🏹 55g
                                </button>
                                <button
                                  onClick={() => handlePlaceTower(pad.id, 'cannon')}
                                  disabled={goldM1 < 140}
                                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-900 hover:bg-amber-800 text-amber-200 disabled:opacity-30 cursor-pointer"
                                  title="Build Cannon (140g)"
                                >
                                  💥 140g
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-amber-400/80 font-mono italic">{pad.tip}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/30 text-xs text-slate-300 flex items-center gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong>Tactical Tip:</strong> Place an <strong>Archer Tower</strong> (high fire rate) along early bends to intercept fast runners, and place a <strong>Cannon</strong> (25% slow on-hit) at the main intersection to bunch packs together!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODULE 2: DUAL DAMAGE CHANNELS & ARMOR COUNTERS */}
        {/* ========================================================================= */}
        {activeModule === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-600/30">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Lesson 2 of 4: Combat Math
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                Physical vs. Mental Damage & Armor Penetration
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Understanding damage channels is the single most important skill for a Defender. Physical hits are blunted flatly by armor. Mental hits bypass armor entirely and amplify subsequent mental attacks!
              </p>
            </div>

            {/* Interactive Target Sandbox */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-amber-950 border border-amber-400 flex items-center justify-center text-2xl">
                    🛡️
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">Palace Royal Guard (Sar Bal Gyi)</h5>
                    <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300">Armor: 8 (Heavy)</span>
                      <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300">Mental Resolve: 0% (Vulnerable)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleResetM2}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition"
                >
                  Reset Mob HP
                </button>
              </div>

              {/* Mob HP Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Target Health</span>
                  <span className={m2TargetHp === 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {m2TargetHp} / 420 HP {m2TargetHp === 0 ? '(SLAIN!)' : ''}
                  </span>
                </div>
                <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${(m2TargetHp / 420) * 100}%` }}
                  />
                </div>
                {m2CrackActive && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-purple-300 animate-pulse">
                    <span>⚡ MENTAL CRACK ACTIVE:</span>
                    <span>Target's resolve is broken! Subsequent mental attacks deal 2x damage!</span>
                  </div>
                )}
              </div>

              {/* Test Attack Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => handleAttackM2('archer')}
                  disabled={m2TargetHp <= 0}
                  className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-left transition disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span>🏹 Archer Tower</span>
                    <span className="text-[10px] text-slate-400">Physical</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    10 Damage − 8 Armor = <strong className="text-red-300">2 Damage</strong>. Almost ineffective!
                  </p>
                </button>

                <button
                  onClick={() => handleAttackM2('spear')}
                  disabled={m2TargetHp <= 0}
                  className="p-3 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-600/60 text-left transition disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                    <span>🔱 Spear Tower</span>
                    <span className="text-[10px] text-emerald-400 font-mono">50% Armor Pierce</span>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1">
                    8 Damage − 4 Effective Armor = <strong className="text-emerald-300">4 Damage</strong> per thrust!
                  </p>
                </button>

                <button
                  onClick={() => handleAttackM2('bell')}
                  disabled={m2TargetHp <= 0}
                  className="p-3 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/60 text-left transition disabled:opacity-40 cursor-pointer"
                >
                  <div className="text-xs font-bold text-purple-300 flex items-center justify-between">
                    <span>🔔 Bell Tower</span>
                    <span className="text-[10px] text-purple-400">Mental Bypass</span>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1">
                    Ignores Armor completely! Deals 12 dmg, cracks resolve, then deals <strong className="text-purple-300">24 dmg</strong>!
                  </p>
                </button>
              </div>

              {/* Combat Log */}
              {m2CombatLog.length > 0 && (
                <div className="bg-black/60 rounded-lg p-2.5 border border-slate-800 space-y-1 font-mono text-[10px]">
                  {m2CombatLog.map((log, i) => (
                    <div key={i} className="text-amber-200/90 truncate">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODULE 3: UPGRADES, TIER SCALING & STRATEGIC SELLING */}
        {/* ========================================================================= */}
        {activeModule === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-600/30">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Lesson 3 of 4: Tower Economy
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                Tier Upgrades & The 70% Sell Refund
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Every tower has 3 upgrade tiers with custom scaling. Upgrading increases damage, range, and attack speed. If an enemy changes wave paths or you need emergency gold, selling any placed tower refunds <strong>70% of total invested gold</strong>!
              </p>
            </div>

            {/* Interactive Upgrade Card */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏹</span>
                  <div>
                    <h5 className="text-sm font-bold text-amber-200">Archer Tower Workbench</h5>
                    <span className="text-[10px] text-slate-400">Base Cost: 55g | Tier 2: 105g | Tier 3: 185g</span>
                  </div>
                </div>

                {m3Sold ? (
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM3Sold(false);
                      setM3Tier(1);
                    }}
                    className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-xs font-bold text-slate-950 transition"
                  >
                    Rebuild Tower (55g)
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM3Sold(true);
                    }}
                    className="px-3 py-1 rounded bg-red-950 hover:bg-red-900 text-xs font-bold text-red-300 border border-red-600/50 transition cursor-pointer"
                  >
                    Sell Tower (Refund: {Math.round((55 + (m3Tier >= 2 ? 105 : 0) + (m3Tier >= 3 ? 185 : 0)) * 0.7)}g)
                  </button>
                )}
              </div>

              {!m3Sold ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1, 2, 3].map((t) => {
                    const isUnlocked = m3Tier >= t;
                    const isCurrent = m3Tier === t;
                    const stats = [
                      { dmg: '10 - 14', rng: '140px', rate: '2.0/s', cost: '55g (Built)' },
                      { dmg: '18 - 26', rng: '160px', rate: '2.15/s', cost: '+105g' },
                      { dmg: '32 - 48', rng: '185px', rate: '2.3/s', cost: '+185g' },
                    ][t - 1];

                    return (
                      <div
                        key={t}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                          isCurrent
                            ? 'bg-amber-950/60 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                            : isUnlocked
                              ? 'bg-slate-800/80 border-slate-600'
                              : 'bg-black/40 border-dashed border-slate-700 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-amber-200">TIER {t}</span>
                            <span className="text-[10px] font-mono text-amber-400">{stats.cost}</span>
                          </div>
                          <div className="space-y-1 text-[11px] text-slate-300 font-mono">
                            <div>Damage: <span className="text-white font-bold">{stats.dmg}</span></div>
                            <div>Range: <span className="text-amber-300">{stats.rng}</span></div>
                            <div>Speed: <span className="text-emerald-400">{stats.rate}</span></div>
                          </div>
                        </div>

                        <div className="mt-3">
                          {isCurrent ? (
                            <span className="block text-center text-[10px] font-bold text-amber-300 py-1 rounded bg-black/40 border border-amber-500/40">
                              ACTIVE TIER ✓
                            </span>
                          ) : m3Tier + 1 === t ? (
                            <button
                              onClick={() => {
                                soundEffects.playClick();
                                setM3Tier(t);
                              }}
                              className="w-full py-1 text-[10px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                            >
                              Upgrade to Tier {t}
                            </button>
                          ) : (
                            <span className="block text-center text-[10px] text-slate-500 py-1">
                              {isUnlocked ? 'Unlocked' : `Requires Tier ${t - 1}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-black/50 border border-dashed border-red-600/40 text-center text-xs text-red-300">
                  Tower has been sold! Stone pad is now vacant and ready for new tactical construction.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODULE 4: TARGET AGGRO & CC SYNERGY */}
        {/* ========================================================================= */}
        {activeModule === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-600/30">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Lesson 4 of 4: Advanced Tactical Synergy
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                Taunt Aggro Redirection & Crowd Control Combos
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                By default, all towers shoot the enemy closest to the Palace Core. However, when an enemy <strong>Shield Bearer</strong> enters range, his <strong>Royal Taunt</strong> forces all single-target towers to attack him! Additionally, pairing <strong>Cannon Slow</strong> with <strong>AoE Bomb Towers</strong> creates devastating kill clusters.
              </p>
            </div>

            {/* Interactive Simulation Display */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-amber-200">Interactive Aggro Simulator:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM4TauntActive((prev) => !prev);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      m4TauntActive
                        ? 'bg-red-900 border-red-400 text-red-200'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {m4TauntActive ? '🛡️ Shield Taunt: ON' : '🛡️ Shield Taunt: OFF'}
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM4SlowActive((prev) => !prev);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      m4SlowActive
                        ? 'bg-cyan-900 border-cyan-400 text-cyan-200'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {m4SlowActive ? '❄️ Cannon Slow (25%): ON' : '❄️ Cannon Slow: OFF'}
                  </button>
                </div>
              </div>

              {/* Aggro Flow Visualization */}
              <div className="bg-[#120a0d] p-4 rounded-xl border border-amber-600/40 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏹</span>
                    <div>
                      <div className="text-amber-200 font-bold">Archer Tower Firing Line</div>
                      <div className="text-[10px] text-slate-400">
                        {m4TauntActive ? 'FORCED TO ATTACK TAUNT TARGET!' : 'Targeting: Nearest to Palace Core'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                      {m4TauntActive ? 'Target: Shield Bearer' : 'Target: Lead Monkey'}
                    </span>
                  </div>
                </div>

                <div className="relative h-16 bg-[#211217] rounded-lg border border-slate-700 flex items-center px-4 justify-between">
                  {/* Units walking on lane */}
                  <div className="flex items-center gap-6">
                    <div
                      className={`flex flex-col items-center p-1.5 rounded transition ${
                        !m4TauntActive ? 'bg-amber-500/20 border border-amber-400 scale-105' : 'opacity-60'
                      }`}
                    >
                      <span className="text-xl">🐒</span>
                      <span className="text-[9px] font-bold text-amber-200">Lead Monkey</span>
                      <span className="text-[8px] text-slate-400">Nearest to Core</span>
                    </div>

                    <div
                      className={`flex flex-col items-center p-1.5 rounded transition ${
                        m4TauntActive ? 'bg-red-500/30 border border-red-400 scale-110 animate-pulse' : 'opacity-60'
                      }`}
                    >
                      <span className="text-xl">🛡️</span>
                      <span className="text-[9px] font-bold text-red-300">Shield Bearer</span>
                      <span className="text-[8px] text-red-400 font-mono">Taunt Aura (140px)</span>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-slate-400">
                    <div>Movement Speed: <strong className={m4SlowActive ? 'text-cyan-300' : 'text-emerald-300'}>{m4SlowActive ? '75% (Slowed)' : '100% (Normal)'}</strong></div>
                    <div>Clustering: <strong className={m4SlowActive ? 'text-amber-300' : 'text-slate-400'}>{m4SlowActive ? 'Tightly Packed (AoE Weak)' : 'Spread Out'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Defender Knowledge Check / Quiz */}
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-600/40 space-y-3">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
                  Citadel Mastery Check
                </span>
                <p className="text-xs text-white font-medium">
                  Which tower completely ignores physical armor and cracks the enemy's mental resolve?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 1, label: 'Archer Tower' },
                    { id: 2, label: 'Sacred Bell Tower' },
                    { id: 3, label: 'Cannon Tower' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        soundEffects.playClick();
                        setQuizAnswer(opt.id);
                        setQuizSubmitted(true);
                      }}
                      className={`p-2.5 rounded-lg text-xs font-bold border transition text-left cursor-pointer ${
                        quizAnswer === opt.id
                          ? opt.id === 2
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                            : 'bg-red-950 border-red-400 text-red-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {quizSubmitted && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-bold ${
                      quizAnswer === 2
                        ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
                        : 'bg-red-950/80 border border-red-500 text-red-200'
                    }`}
                  >
                    {quizAnswer === 2
                      ? '✓ CORRECT! The Sacred Bell Tower deals pure mental damage, bypassing physical armor and cracking enemies for double follow-up damage!'
                      : '✗ Not quite! Archer and Cannon deal physical damage that gets mitigated by armor. The Sacred Bell Tower deals mental damage that bypasses armor!'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
