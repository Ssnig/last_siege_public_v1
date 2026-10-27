import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DefenderTutorial } from './DefenderTutorial';
import { AttackerTutorial } from './AttackerTutorial';
import { soundEffects } from '../../audio/soundEffects';

export const TutorialPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'defender' | 'attacker'>('defender');

  return (
    <div className="w-screen h-screen bg-[#0d0709] text-white flex flex-col overflow-hidden relative select-none">
      {/* Background Ambience Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
        style={{ backgroundImage: 'url(/assets/landing/landing_background.png)' }}
      />
      <div className="absolute inset-0 bg-radial from-transparent via-[#0d0709]/70 to-[#0d0709] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 px-4 py-3 bg-gradient-to-r from-[#21090c] via-[#120507] to-[#21090c] border-b-2 border-[#8a661b] shadow-xl flex items-center justify-between shrink-0">
        {/* Left: Back to Menu */}
        <button
          onClick={() => {
            soundEffects.playClick();
            navigate('/lobby');
          }}
          onMouseEnter={() => soundEffects.playHover()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-amber-600/40 hover:border-amber-400 text-amber-200 hover:text-white transition cursor-pointer text-xs font-bold"
        >
          <span>←</span>
          <span>Back to Match Lobby</span>
        </button>

        {/* Center: Title & Filigree */}
        <div className="text-center">
          <h1
            className="text-lg sm:text-2xl font-black text-[#fce38a] font-['Almendra',serif] tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          >
            The Royal War Academy
          </h1>
          <p className="text-[10px] sm:text-xs text-amber-300/70 font-serif italic">
            Imperial Combat Training of the Konbaung Dynasty
          </p>
        </div>

        {/* Right: Role Switcher Pill */}
        <div className="flex items-center bg-black/60 p-1 rounded-xl border border-amber-600/40 gap-1">
          <button
            onClick={() => {
              soundEffects.playClick();
              setSelectedRole('defender');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              selectedRole === 'defender'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                : 'text-amber-200/70 hover:bg-slate-800'
            }`}
          >
            <span>🛡️</span>
            <span>Defender</span>
          </button>
          <button
            onClick={() => {
              soundEffects.playClick();
              setSelectedRole('attacker');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              selectedRole === 'attacker'
                ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                : 'text-red-200/70 hover:bg-slate-800'
            }`}
          >
            <span>⚔️</span>
            <span>Attacker</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Workbench Container */}
      <main className="relative z-10 flex-1 p-3 sm:p-5 flex flex-col min-h-0 max-w-6xl w-full mx-auto">
        {selectedRole === 'defender' ? <DefenderTutorial /> : <AttackerTutorial />}
      </main>

      {/* Bottom Footer Bar */}
      <footer className="relative z-20 px-4 py-2 bg-[#120507] border-t border-amber-900/40 flex items-center justify-between text-[11px] text-amber-200/60 font-mono shrink-0">
        <div className="flex items-center gap-3">
          <span>👑 Royal War Academy</span>
          <span>•</span>
          <span>Practice Interactive Simulations</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEffects.playClick();
              navigate('/almanac');
            }}
            className="text-amber-300 hover:underline cursor-pointer"
          >
            Open War Codex & Almanac →
          </button>
        </div>
      </footer>
    </div>
  );
};
