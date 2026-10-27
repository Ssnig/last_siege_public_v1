import React, { useState } from 'react';
import { soundEffects } from '../../audio/soundEffects';

export const AttackerTutorial: React.FC = () => {
  const [activeModule, setActiveModule] = useState<number>(1);

  // Module 1: Deploy Buffer Simulator
  const [m1Gold, setM1Gold] = useState<number>(150);
  const [m1Buffer, setM1Buffer] = useState<Array<{ id: string; name: string; cost: number; icon: string }>>([]);
  const [m1Charges, setM1Charges] = useState<number>(3);
  const [m1DeployedWaves, setM1DeployedWaves] = useState<number>(0);

  // Module 2: Income Simulator
  
  const [m2IncomeRate, setM2IncomeRate] = useState<number>(10); // starting base income
  const [m2DeepBonusActive, setM2DeepBonusActive] = useState<boolean>(false);

  // Module 3: Formation & Aura Simulator
  const [m3Vanguard, setM3Vanguard] = useState<boolean>(true); // Shield Bearer
  const [m3SpeedAura, setM3SpeedAura] = useState<boolean>(true); // Doe Pat
  const [m3HealAura, setM3HealAura] = useState<boolean>(true); // Say Sayar

  // Module 4: Victory Core HP Calculator
  const [m4CoreHp, setM4CoreHp] = useState<number>(20);
  const [m4BreachLog, setM4BreachLog] = useState<string[]>([]);

  // Quiz State
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  // Handlers for Module 1: Buffer Queue
  const handleQueueUnit = (unit: { id: string; name: string; cost: number; icon: string }) => {
    soundEffects.playClick();
    if (m1Gold >= unit.cost && m1Buffer.length < 8) {
      setM1Buffer((prev) => [...prev, unit]);
      setM1Gold((prev) => prev - unit.cost);
      // Scaling income in Module 2
      
      setM2IncomeRate((prev) => prev + Math.max(1, Math.round(unit.cost * 0.15)));
    }
  };

  const handleRemoveFromBuffer = (index: number) => {
    soundEffects.playClick();
    const item = m1Buffer[index];
    if (item) {
      setM1Gold((prev) => prev + item.cost);
      setM1Buffer((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleDeployPortal = () => {
    if (m1Buffer.length === 0 || m1Charges <= 0) return;
    soundEffects.playWarDrum('heavy');
    setM1Charges((prev) => prev - 1);
    setM1DeployedWaves((prev) => prev + 1);
    setM1Buffer([]);
  };

  const handleResetM1 = () => {
    soundEffects.playClick();
    setM1Gold(150);
    setM1Buffer([]);
    setM1Charges(3);
    setM1DeployedWaves(0);
  };

  // Handlers for Module 4: Core Infiltration
  const handleLeakMob = (unitName: string, leakDmg: number) => {
    soundEffects.playClick();
    const newHp = Math.max(0, m4CoreHp - leakDmg);
    setM4CoreHp(newHp);
    const log = `⚡ ${unitName} breached the palace! Dealt −${leakDmg} Core HP! (Remaining: ${newHp}/20)`;
    setM4BreachLog((prev) => [log, ...prev.slice(0, 3)]);
    if (newHp === 0) {
      soundEffects.playVictory();
    }
  };

  const handleResetM4 = () => {
    soundEffects.playClick();
    setM4CoreHp(20);
    setM4BreachLog([]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950/80 rounded-xl border border-red-600/40 shadow-2xl overflow-hidden">
      {/* Top Module Navigation Bar */}
      <div className="p-3 bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-950 border-b border-red-600/30 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <div>
            <h3 className="text-base sm:text-lg font-black text-red-200 font-['Almendra',serif] tracking-wide">
              ATTACKER ACADEMY — THE SIEGE WARLORD
            </h3>
            <p className="text-[11px] text-red-300/70 italic font-serif">
              Master the deploy buffer, portal charges, wave economy, and synergistic auras.
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
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                  : 'bg-slate-900/90 text-red-200/70 border border-red-700/40 hover:bg-slate-800'
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
        {/* MODULE 1: PORTALS, CHARGES & THE DEPLOY BUFFER */}
        {/* ========================================================================= */}
        {activeModule === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-red-600/30">
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider block mb-1">
                Lesson 1 of 4: Wave Deployment Mechanics
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                The Deploy Buffer & Portal Charges
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Unlike traditional tower defense games where enemies spawn on automatic timers, <strong>you control the invasion</strong>! You spend gold to queue units into your <strong>Deploy Buffer</strong>, then click a spawn portal to unleash the entire squad in staggered formation.
              </p>
            </div>

            {/* Interactive Deploy Buffer Workbench */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-red-500/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400">War Chest: </span>
                    <strong className="text-amber-300">💰 {m1Gold}g</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Portal Charges: </span>
                    <strong className="text-cyan-300">⚡ {m1Charges}/3</strong>
                  </div>
                </div>

                <button
                  onClick={handleResetM1}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition"
                >
                  Reset Workbench
                </button>
              </div>

              {/* Unit Selection Grid */}
              <div>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Click to Queue Units into Buffer (Max 8):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'monkey', name: 'Monkey Swarm', cost: 8, icon: '🐒' },
                    { id: 'horse_rider', name: 'Konbaung Cavalry', cost: 15, icon: '🐎' },
                    { id: 'shield_guy', name: 'Shield Bearer', cost: 40, icon: '🛡️' },
                    { id: 'elephant_rider', name: 'War Elephant', cost: 200, icon: '🐘' },
                  ].map((unit) => (
                    <button
                      key={unit.id}
                      onClick={() => handleQueueUnit(unit)}
                      disabled={m1Gold < unit.cost || m1Buffer.length >= 8}
                      className="p-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-600/40 flex items-center justify-between text-left transition disabled:opacity-30 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{unit.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-white leading-tight">{unit.name}</div>
                          <div className="text-[10px] text-amber-300 font-mono mt-0.5">{unit.cost} Gold</div>
                        </div>
                      </div>
                      <span className="text-base text-red-400 font-bold">+</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* The Active Deploy Buffer Display */}
              <div className="bg-black/60 p-3 rounded-xl border border-red-700/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-red-300">
                    Your Deploy Buffer ({m1Buffer.length} / 8 Units Queued):
                  </span>
                  <span className="text-[10px] text-slate-400">Click unit to refund</span>
                </div>

                <div className="grid grid-cols-8 gap-1.5 h-14">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const item = m1Buffer[i];
                    return (
                      <div
                        key={i}
                        onClick={() => handleRemoveFromBuffer(i)}
                        className={`rounded-lg border flex flex-col items-center justify-center p-1 transition cursor-pointer ${
                          item
                            ? 'bg-red-900/60 border-red-400 hover:bg-red-800'
                            : 'bg-black/30 border-dashed border-slate-700'
                        }`}
                      >
                        {item ? (
                          <>
                            <span className="text-base leading-none">{item.icon}</span>
                            <span className="text-[8px] font-mono text-amber-200 mt-0.5">{item.cost}g</span>
                          </>
                        ) : (
                          <span className="text-[9px] text-slate-600 font-mono">#{i + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Deploy Button */}
                <button
                  onClick={handleDeployPortal}
                  disabled={m1Buffer.length === 0 || m1Charges <= 0}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-black text-xs text-white uppercase tracking-wider shadow-lg transition active:scale-98 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>🌀</span>
                  <span>Deploy Squad Through Portal (Uses 1 Charge)</span>
                </button>
              </div>

              {m1DeployedWaves > 0 && (
                <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <span>✓</span>
                  <span>
                    <strong>Wave #{m1DeployedWaves} deployed!</strong> Units march along the lane in ordered sequence. Portal charges regenerate automatically over time.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODULE 2: THE RECURRING INCOME ENGINE */}
        {/* ========================================================================= */}
        {activeModule === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-red-600/30">
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider block mb-1">
                Lesson 2 of 4: War Economy
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                Recurring Income Scaling & Deep-Penetration Gold
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                While defenders earn gold by killing your troops, <strong>Attackers earn gold through recurring economic growth</strong>! Every unit you deploy permanently boosts your <strong>Income Rate</strong>, which flows directly into your war chest every 10 seconds.
              </p>
            </div>

            {/* Income Simulation Dashboard */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-red-500/40 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-amber-950/40 p-3.5 rounded-xl border border-amber-600/40">
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                    Current Recurring Income Rate
                  </span>
                  <div className="text-2xl font-black text-amber-200 font-mono mt-1">
                    +{m2IncomeRate} Gold / 10s
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Increases permanently every time you deploy units from your queue.
                  </p>
                </div>

                <div className="bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-600/40">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                    Deep-Penetration Track Bonus
                  </span>
                  <div className="text-2xl font-black text-emerald-200 font-mono mt-1">
                    {m2DeepBonusActive ? '+4 Gold / unit' : '0 (Before 50% Mark)'}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Active when units push past 50% track distance towards the palace!
                  </p>
                </div>
              </div>

              {/* Interactive Path Progress Slider */}
              <div className="bg-black/60 p-4 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">Unit Distance Along Lane:</span>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM2DeepBonusActive((prev) => !prev);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                      m2DeepBonusActive
                        ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    {m2DeepBonusActive ? 'Track Progress: 75% (DEEP IN ROAD)' : 'Track Progress: 25% (EARLY LANE)'}
                  </button>
                </div>

                {/* Visual Progress Track */}
                <div className="relative h-6 bg-slate-950 rounded-full border border-slate-700 overflow-hidden flex items-center">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: m2DeepBonusActive ? '75%' : '25%' }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-yellow-400 z-10" />
                  <span className="absolute left-[52%] text-[9px] text-yellow-300 font-bold pointer-events-none">
                    50% Mark (Deep Income Threshold)
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-amber-950/30 border border-amber-600/30 text-xs text-slate-300 flex items-center gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong>Warlord's Rule:</strong> Never stockpile idle gold! Spending early gold to launch waves builds your recurring income engine, guaranteeing late-game financial supremacy over the Defender!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODULE 3: MASTER SIEGE FORMATIONS & ACTIVE AURAS */}
        {/* ========================================================================= */}
        {activeModule === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-red-600/30">
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider block mb-1">
                Lesson 3 of 4: Wave Composition
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                The Holy Trinity: Tank, Buffers & Swarm
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Sending raw units one by one allows towers to pick them off easily. To breach reinforced choke points, commanders assemble <strong>The Holy Trinity Formation</strong>:
              </p>
            </div>

            {/* Formation Builder Sandbox */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-red-500/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-red-300">Formation Synergy Toggles:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM3Vanguard((prev) => !prev);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      m3Vanguard
                        ? 'bg-red-950 border-red-400 text-red-200'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    🛡️ Vanguard (Taunt): {m3Vanguard ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM3SpeedAura((prev) => !prev);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      m3SpeedAura
                        ? 'bg-yellow-950 border-yellow-400 text-yellow-200'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    🥁 Speed Drummer (+40%): {m3SpeedAura ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setM3HealAura((prev) => !prev);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      m3HealAura
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    🌿 Physician (Heal Aura): {m3HealAura ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Interactive Formation Card Stack */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Vanguard */}
                <div
                  className={`p-3.5 rounded-xl border transition ${
                    m3Vanguard
                      ? 'bg-red-950/60 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                      : 'bg-black/40 border-slate-700 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🛡️</span>
                    <div>
                      <h6 className="text-xs font-bold text-white">1. The Vanguard Tank</h6>
                      <span className="text-[10px] text-red-300 font-mono">Shield Bearer</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Marches at the front. Employs <strong>Royal Taunt</strong> to redirect all incoming sniper and arrow shots away from fragile support allies.
                  </p>
                </div>

                {/* 2. Support Engines */}
                <div
                  className={`p-3.5 rounded-xl border transition ${
                    m3SpeedAura || m3HealAura
                      ? 'bg-amber-950/60 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                      : 'bg-black/40 border-slate-700 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🥁</span>
                    <div>
                      <h6 className="text-xs font-bold text-white">2. Support Engines</h6>
                      <span className="text-[10px] text-amber-300 font-mono">Drummer & Healer</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    <strong>Doe Pat</strong> grants <strong>+40% movement speed</strong> so heavy units rush choke points. <strong>Say Sayar</strong> pulses <strong>80 HP healing</strong> to wounded troops.
                  </p>
                </div>

                {/* 3. Swarm / Infiltration */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🐒</span>
                    <div>
                      <h6 className="text-xs font-bold text-white">3. Infiltration Strike Squad</h6>
                      <span className="text-[10px] text-emerald-300 font-mono">Monkeys / Cavalry</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Rapid runner squads sheltered behind the shield wall sprint forward to penetrate the palace and deal direct Core damage!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODULE 4: INFILTRATION & PALACE VICTORY */}
        {/* ========================================================================= */}
        {activeModule === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-red-600/30">
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider block mb-1">
                Lesson 4 of 4: Winning the Siege
              </span>
              <h4 className="text-lg font-bold text-white font-['Almendra',serif]">
                Leak Damage & Core Annihilation
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Your ultimate objective as the Attacker is simple: <strong>Reduce the Defender's Core HP from 20 to 0</strong>! Every unit that survives the gauntlet and breaches the palace deals direct Leak Damage to the core.
              </p>
            </div>

            {/* Core HP Simulator */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-red-500/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏰</span>
                  <div>
                    <h5 className="text-sm font-bold text-white">Konbaung Palace Core Health</h5>
                    <span className="text-[10px] text-slate-400">Attacker Victory Condition: Reach 0 HP</span>
                  </div>
                </div>

                <button
                  onClick={handleResetM4}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition"
                >
                  Reset Core HP
                </button>
              </div>

              {/* Core HP Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Defender Core Integrity</span>
                  <span className={m4CoreHp === 0 ? 'text-red-400 font-bold' : 'text-amber-300 font-bold'}>
                    {m4CoreHp} / 20 HP {m4CoreHp === 0 ? '👑 PALACE BREACHED — ATTACKER WINS!' : ''}
                  </span>
                </div>
                <div className="w-full h-4 bg-black/60 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${(m4CoreHp / 20) * 100}%` }}
                  />
                </div>
              </div>

              {/* Leak Damage Buttons */}
              <div>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Simulate Unit Infiltrating Palace:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: 'Monkey', dmg: 1, icon: '🐒' },
                    { name: 'Palace Royal Guard', dmg: 3, icon: '⚔️' },
                    { name: 'Belu Ogre', dmg: 5, icon: '👹' },
                    { name: 'War Elephant', dmg: 10, icon: '🐘' },
                  ].map((unit) => (
                    <button
                      key={unit.name}
                      onClick={() => handleLeakMob(unit.name, unit.dmg)}
                      disabled={m4CoreHp <= 0}
                      className="p-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-600/40 text-left transition disabled:opacity-30 cursor-pointer"
                    >
                      <div className="text-xl mb-1">{unit.icon}</div>
                      <div className="text-xs font-bold text-white">{unit.name}</div>
                      <div className="text-[10px] text-red-400 font-mono mt-0.5">−{unit.dmg} Leak HP</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Breach Log */}
              {m4BreachLog.length > 0 && (
                <div className="bg-black/60 rounded-lg p-2.5 border border-slate-800 space-y-1 font-mono text-[10px]">
                  {m4BreachLog.map((log, i) => (
                    <div key={i} className="text-red-300 truncate">
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Attacker Knowledge Check / Quiz */}
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-950 border border-red-600/40 space-y-3">
                <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider block">
                  Warlord Mastery Check
                </span>
                <p className="text-xs text-white font-medium">
                  How does an Attacker generate recurring gold income throughout the battle?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 1, label: 'Waiting for towers to sell' },
                    { id: 2, label: 'Deploying units permanently increases income rate' },
                    { id: 3, label: 'Killing enemy towers' },
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
                      ? '✓ CORRECT! Every unit you deploy permanently scales your recurring Income Rate, paying out every 10s!'
                      : '✗ Not quite! Deploying units permanently scales your recurring Income Rate (paid out every 10s), plus extra bonuses when units push past 50% distance!'}
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
