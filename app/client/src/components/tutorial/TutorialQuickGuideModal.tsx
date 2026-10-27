import React, { useState } from 'react';
import { soundEffects } from '../../audio/soundEffects';

interface TutorialQuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'defender' | 'attacker' | 'phases';
}

export const TutorialQuickGuideModal: React.FC<TutorialQuickGuideModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'defender',
}) => {
  const [activeTab, setActiveTab] = useState<'defender' | 'attacker' | 'phases'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-slate-950 rounded-2xl border-2 border-[#8a661b] shadow-2xl flex flex-col overflow-hidden animate-modalPop text-slate-200"
        style={{
          boxShadow: '0 0 40px rgba(0,0,0,0.9), inset 0 0 20px rgba(212,175,55,0.15)',
        }}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-950 border-b border-amber-600/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📜</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-200 font-['Almendra',serif] tracking-wider">
                TACTICAL BATTLE REFERENCE
              </h3>
              <p className="text-[11px] text-amber-300/70 italic font-serif">
                Instant rules & strategic doctrines of the Konbaung Realm
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-900/60 p-1.5 gap-1 shrink-0">
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('defender');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'defender'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-amber-200/70 hover:bg-slate-800'
            }`}
          >
            <span>🛡️</span> Defender Doctrines
          </button>
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('attacker');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'attacker'
                ? 'bg-red-600 text-white shadow-md font-black'
                : 'text-red-200/70 hover:bg-slate-800'
            }`}
          >
            <span>⚔️</span> Attacker Doctrines
          </button>
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab('phases');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'phases'
                ? 'bg-amber-800 text-white shadow-md font-black'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>⏱️</span> Match Phases
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3.5 text-xs">
          {activeTab === 'defender' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/30">
                <h5 className="font-bold text-amber-300 mb-1 text-sm font-['Almendra',serif]">
                  1. Placement & Choke Points
                </h5>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Place towers on <strong>corners, bends, and intersections</strong>. Bends force enemies to walk along the tower's firing arc for more than twice as long as a straight stretch!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30">
                <h5 className="font-bold text-purple-300 mb-1 text-sm font-['Almendra',serif]">
                  2. Dual Damage Channels (Physical vs Mental)
                </h5>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <strong className="text-slate-200">Physical Damage:</strong> Blunted flatly by target Armor (Archer, Gun, Cannon). Against 8 Armor, light arrows deal near-zero damage!
                  </div>
                  <div>
                    <strong className="text-purple-300">Mental Damage:</strong> The <strong>Sacred Bell Tower</strong> completely ignores physical armor and cracks the target, doubling follow-up mental damage!
                  </div>
                  <div>
                    <strong className="text-emerald-300">Armor Penetration:</strong> The <strong>Spear Tower</strong> ignores 50% of armor to pierce heavy vanguards.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                <h5 className="font-bold text-amber-200 mb-1 text-sm font-['Almendra',serif]">
                  3. Tier Upgrades & 70% Sell Refund
                </h5>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Upgrade towers from Tier 1 to Tier 3 to boost DPS, range, and fire rate. Need emergency gold or did the enemy switch lanes? <strong>Sell any placed tower for an instant 70% refund</strong> of all gold invested!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'attacker' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-600/30">
                <h5 className="font-bold text-red-300 mb-1 text-sm font-['Almendra',serif]">
                  1. Deploy Buffer & Portal Charges
                </h5>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Queue up to 8 units in your Deploy Buffer using gold. Click a spawn portal to unleash the squad. Spawning costs <strong>1 Portal Charge</strong> (starts with 3, recharges over time).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/30">
                <h5 className="font-bold text-amber-300 mb-1 text-sm font-['Almendra',serif]">
                  2. The War Economy Engine
                </h5>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <strong className="text-amber-200">Recurring Wave Income:</strong> Every unit deployed permanently raises your recurring Income Rate (paid out every 10 seconds). Never hold idle gold!
                  </div>
                  <div>
                    <strong className="text-emerald-300">Deep-Penetration Bonus:</strong> Units penetrating past 50% track distance generate extra bonus gold for the attacker.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                <h5 className="font-bold text-red-200 mb-1 text-sm font-['Almendra',serif]">
                  3. The Holy Trinity Formation
                </h5>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  • <strong>Vanguard:</strong> Shield Bearer uses <strong>Royal Taunt</strong> to soak single-target sniper fire.<br/>
                  • <strong>Aura Core:</strong> Doe Pat Drummer grants <strong>+40% speed</strong>; Say Sayar restores <strong>80 HP healing</strong>.<br/>
                  • <strong>Infiltration:</strong> Fast Monkey Swarms or massive War Elephants (10 Core Leak Damage) breach the palace!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="space-y-2.5 animate-fadeIn">
              {[
                {
                  step: 'Phase 1',
                  name: 'Map Reveal (5s)',
                  desc: 'The arena is selected from the 9 ancient battlefields. Examine portal locations, stone slot clusters, and choke points.',
                },
                {
                  step: 'Phase 2',
                  name: '3-Round Tactical Draft (2-2-2)',
                  desc: 'Pick 2 cards per round across 3 rounds (6 total). You can see the cards your opponent drafts each round, allowing strategic counter-picking!',
                },
                {
                  step: 'Phase 3',
                  name: 'Building Phase (30s)',
                  desc: 'Defender spends starting gold to construct towers on stone pads. The defender can click "Start Combat Now" as soon as preparations are complete.',
                },
                {
                  step: 'Phase 4',
                  name: 'Combat Wave Siege',
                  desc: 'Attacker launches waves through portals. Defender earns kill bounties to upgrade towers. Attacker wins if Core HP hits 0; Defender wins if the Core survives until the siege timer expires!',
                },
              ].map((p, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded bg-black/60 border border-amber-600/40 text-[10px] font-mono font-bold text-amber-300 shrink-0">
                    {p.step}
                  </span>
                  <div>
                    <h6 className="font-bold text-white text-xs">{p.name}</h6>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">
            Full Interactive Academy available at /tutorial
          </span>
          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            Return to Match
          </button>
        </div>
      </div>
    </div>
  );
};
