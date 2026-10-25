import React from 'react';

export const AlmanacCodexTab: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-1 sm:p-2 custom-scrollbar">
      {/* Intro Banner */}
      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-950 border border-amber-600/40 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📜</span>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-amber-200 font-['Almendra',serif] tracking-wider uppercase">
              The Royal War Codex & Combat Doctrines
            </h3>
            <p className="text-xs text-amber-300/80 font-serif italic mt-0.5">
              Essential strategies, damage mechanics, and economic engines of the Konbaung Realm.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Rule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Damage Channels */}
        <div className="bg-slate-950/80 rounded-xl border border-amber-600/40 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-2xl">⚔️</span>
              <h4 className="text-sm sm:text-base font-bold text-amber-200 font-['Almendra',serif] uppercase tracking-wide">
                1. Dual Damage Channels
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Combat in Versus TD is governed by two fundamentally distinct damage channels. Understanding when to deploy physical vs mental force is the cornerstone of victory:
            </p>

            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-1">
                  <span>⚔️ Physical Damage (Steel & Gunpowder)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Blunted by Armor</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Dealt by Archers, Cannons, Guns, and Mortars. Physical hits are blunted by the unit's <strong>Armor</strong> stat.
                  A Sar Bal Gyi with 8 Armor shrugs off ordinary arrows, requiring heavy ordnance or high caliber to pierce.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/40">
                <div className="flex items-center justify-between text-xs font-bold text-purple-200 mb-1">
                  <span>🧠 Mental Damage (Sacred Resonances)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300">Bypasses Armor</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Dealt by the Sacred Bell Tower. Mental pulses <strong>completely ignore physical armor</strong>! Furthermore,
                  each mental hit cracks the target's resolve, multiplying all subsequent mental damage they suffer.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-amber-300/80 italic font-serif">
            💡 Tip: When defenders build heavy armored vanguards, pivot into Sacred Bell Towers!
          </div>
        </div>

        {/* Card 2: The War Economy Engine */}
        <div className="bg-slate-950/80 rounded-xl border border-amber-600/40 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-2xl">💰</span>
              <h4 className="text-sm sm:text-base font-bold text-amber-200 font-['Almendra',serif] uppercase tracking-wide">
                2. The Economy Engine
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Gold drives both sides of the war, but Attacker and Defender generate wealth through opposing strategic engines:
            </p>

            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-600/40">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1">
                  <span>⚔️ Attacker: Wave Income Scaling</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 font-mono">Recurring Income</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Deploying units into the portal buffer costs upfront gold. However, every unit deployed grants a <strong>permanent boost to your recurring Income Rate</strong>!
                  Every 10 seconds, this income rate flows directly into your war chest.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-600/40">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300 mb-1">
                  <span>🛡️ Defender: Kill Bounties & Upgrades</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-200 font-mono">70% Refund</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Every attacker slain on the battlefield awards an instant <strong>Gold Bounty</strong> directly to the defender.
                  Defenders invest gold to build and upgrade towers. Selling any placed tower refunds <strong>70% of invested gold</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-amber-300/80 italic font-serif">
            💡 Tip: Attackers who stop sending waves forfeit economic growth and will be overwhelmed in the late game!
          </div>
        </div>

        {/* Card 3: Match Lifecycle & Phase Flow */}
        <div className="bg-slate-950/80 rounded-xl border border-amber-600/40 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-2xl">⏳</span>
              <h4 className="text-sm sm:text-base font-bold text-amber-200 font-['Almendra',serif] uppercase tracking-wide">
                3. Match Lifecycle & Phase Flow
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Matches follow an authoritative four-stage lifecycle designed for high tactical tension:
            </p>

            <ol className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2 bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0">Phase 1:</span>
                <div>
                  <strong className="text-amber-200">Map Reveal (5s)</strong> — The arena is drawn from the 9 royal battlefields.
                  Both commanders inspect lane layouts and choke points.
                </div>
              </li>

              <li className="flex items-start gap-2 bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0">Phase 2:</span>
                <div>
                  <strong className="text-amber-200">The 3-Round Draft (2-2-2)</strong> — Commanders pick 2 cards each over 3 rounds.
                  You see opponent picks each round, allowing tactical counter-drafting.
                </div>
              </li>

              <li className="flex items-start gap-2 bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0">Phase 3:</span>
                <div>
                  <strong className="text-amber-200">Building Phase</strong> — Defender places towers onto stone pads.
                  Defender can click "Start Combat Now" as soon as fortifications are ready.
                </div>
              </li>

              <li className="flex items-start gap-2 bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0">Phase 4:</span>
                <div>
                  <strong className="text-amber-200">Combat Wave</strong> — Attacker launches squads through portals.
                  Towers engage targets. If a unit slips into the palace, Defender loses Palace HP!
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-amber-300/80 italic font-serif">
            💡 Tip: The match ends when Palace Core HP reaches 0 (Attacker wins) or defense holds to the end (Defender wins)!
          </div>
        </div>

        {/* Card 4: Special Abilities & Aggro Priority */}
        <div className="bg-slate-950/80 rounded-xl border border-amber-600/40 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-2xl">✨</span>
              <h4 className="text-sm sm:text-base font-bold text-amber-200 font-['Almendra',serif] uppercase tracking-wide">
                4. Tactical Abilities & Aggro Rules
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Units carry decisive active abilities that can break fortress choke points when coordinated properly:
            </p>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-900/70 p-2 rounded border border-slate-800">
                <div className="flex items-center gap-2 text-red-300 font-bold mb-0.5">
                  <span>🛡️</span> Royal Taunt (Shield Bearer)
                </div>
                <p className="text-[11px] text-slate-300">
                  By default, towers target the enemy closest to the royal palace.
                  However, when a Shield Bearer enters range, <strong>all single-target towers are forced to attack him first</strong>,
                  shielding nearby squishy units!
                </p>
              </div>

              <div className="bg-slate-900/70 p-2 rounded border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-300 font-bold mb-0.5">
                  <span>💚</span> Herbalist Healing Aura (Say Sayar)
                </div>
                <p className="text-[11px] text-slate-300">
                  Emits an emerald healing pulse restoring 80 HP to all nearby wounded allies below 50% HP every 6 seconds.
                  Keeps War Elephants and Royal Guards alive through heavy fire.
                </p>
              </div>

              <div className="bg-slate-900/70 p-2 rounded border border-slate-800">
                <div className="flex items-center gap-2 text-yellow-300 font-bold mb-0.5">
                  <span>⚡</span> Martial War Drums (Doe Pat Drummer)
                </div>
                <p className="text-[11px] text-slate-300">
                  Grants a blistering +40% Speed Boost aura to all surrounding troops, allowing slow heavy tanks to sprint past dangerous choke points.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-amber-300/80 italic font-serif">
            💡 Tip: AoE pulses from Bell Towers and splash from Cannons ignore Taunt redirects and damage all units in the area!
          </div>
        </div>
      </div>
    </div>
  );
};
