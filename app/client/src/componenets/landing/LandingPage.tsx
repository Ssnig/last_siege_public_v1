import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundEffects } from '../../audio/soundEffects';
import { SettingsModal } from './SettingsModal';
import { SocialModal } from './SocialModal';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('player-name') || '';
    } catch {
      return '';
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSocialOpen, setIsSocialOpen] = useState<boolean>(false);
  const [showNamePrompt, setShowNamePrompt] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [isButtonHovered, setIsButtonHovered] = useState<boolean>(false);

  useEffect(() => {
    // Pre-seed audio context on initial user click anywhere
    const enableAudio = () => {
      soundEffects.playHover();
      window.removeEventListener('pointerdown', enableAudio);
    };
    window.addEventListener('pointerdown', enableAudio);
    return () => window.removeEventListener('pointerdown', enableAudio);
  }, []);

  const handleStartClick = () => {
    soundEffects.playClick();
    let storedName = '';
    try {
      storedName = localStorage.getItem('player-name') || '';
    } catch {}
    if (!storedName || !storedName.trim()) {
      setShowNamePrompt(true);
    } else {
      navigate('/lobby');
    }
  };

  const handleConfirmName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    soundEffects.playClick();
    try {
      localStorage.setItem('player-name', trimmed);
    } catch {}
    setPlayerName(trimmed);
    setShowNamePrompt(false);
    navigate('/lobby');
  };


  return (
    <div className="relative w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden select-none">
      {/* Aspect Ratio Master Container matching 2752x1536 resolution */}
      <div className="relative w-full max-w-[2752px] aspect-[2752/1536] max-h-screen overflow-hidden shadow-2xl bg-black">
        {/* Layer 1: Base Landscape */}
        <img
          src="/assets/ui/bg.jpg"
          alt="Battlefield Landscape"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />

        {/* Layer 2: Glassy Blur Layer above bg.png */}
        <div className="absolute inset-0 backdrop-blur-[6px] bg-slate-950/15 pointer-events-none" />

        {/* Layer 3: Left Panel (Attacker Army Vanguard) - Shrunk to fully show and stick to bottom-left */}
        <img
          src="/assets/ui/left_panel_tight.png"
          alt="Attackers Vanguard"
          className="absolute bottom-0 left-0 h-[72%] max-w-[46%] object-contain object-bottom-left pointer-events-none select-none drop-shadow-lg"
        />

        {/* Layer 4: Right Panel (Konbaung Palace & Defenders) - Shrunk to fully show and stick to bottom-right */}
        <img
          src="/assets/ui/right_panel_tight.png"
          alt="Konbaung Defenders & Palace"
          className="absolute bottom-0 right-0 h-[75%] max-w-[46%] object-contain object-bottom-right pointer-events-none select-none drop-shadow-lg"
        />

        {/* Ambient Battlefield Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

        {/* Top-Left Friends / Social Icon Button */}
        <button
          onClick={() => {
            soundEffects.playModal();
            setIsSocialOpen(true);
          }}
          onMouseEnter={() => soundEffects.playHover()}
          className="absolute top-[3.5%] left-[2.2%] z-20 w-[4.5%] min-w-[36px] max-w-[60px] aspect-square flex items-center justify-center rounded-xl bg-slate-950/20 hover:bg-slate-950/40 backdrop-blur-xs border border-white/10 hover:border-cyan-400/60 shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-200 cursor-pointer group active:scale-95"
          title="Warrior Profile & Friends"
          aria-label="Friends and Profile"
        >
          <svg
            className="w-[68%] h-[68%] text-slate-800 group-hover:text-cyan-300 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>

        {/* Top-Right Settings Gear Icon Button */}
        <button
          onClick={() => {
            soundEffects.playModal();
            setIsSettingsOpen(true);
          }}
          onMouseEnter={() => soundEffects.playHover()}
          className="absolute top-[3.5%] right-[2.2%] z-20 w-[4.5%] min-w-[36px] max-w-[60px] aspect-square flex items-center justify-center rounded-xl bg-slate-950/20 hover:bg-slate-950/40 backdrop-blur-xs border border-white/10 hover:border-amber-400/60 shadow-lg hover:shadow-[0_0_20px_rgba(251,146,60,0.4)] transition-all duration-200 cursor-pointer group active:scale-95"
          title="Game Settings"
          aria-label="Settings"
        >
          <svg
            className="w-[68%] h-[68%] text-[#e06c43] group-hover:text-amber-300 transition-all duration-300 group-hover:rotate-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Center Interactive START Button */}
        <div
          className="absolute z-20 left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[23.5%] min-w-[170px] max-w-[340px] h-[9.5%] min-h-[50px] flex items-center justify-center cursor-pointer"
          onMouseEnter={() => {
            setIsButtonHovered(true);
            soundEffects.playHover();
          }}
          onMouseLeave={() => setIsButtonHovered(false)}
          onClick={handleStartClick}
        >
          {/* Subtle neon glow bloom behind the button on hover */}
          <div
            className={`absolute inset-0 rounded-full bg-cyan-400 blur-xl transition-opacity duration-300 ${
              isButtonHovered ? 'opacity-70 scale-110' : 'opacity-0'
            }`}
          />

          {/* Clean Transparent Pixel-Art Play Button Overlay */}
          <img
            src="/assets/ui/play_button_clean.png"
            alt="START GAME"
            className={`relative w-full h-full object-contain transition-transform duration-200 ease-out active:scale-95 ${
              isButtonHovered ? 'scale-105 brightness-110 drop-shadow-[0_0_20px_rgba(34,211,238,0.9)]' : 'scale-100'
            }`}
          />
        </div>

        {/* First-Time Warrior Name Dialog Modal */}
        {showNamePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
            <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-white">
              <h3 className="text-xl font-bold text-amber-300 font-serif mb-2 tracking-wide flex items-center gap-2">
                <span>⚔️</span> ENTER WARRIOR NICKNAME
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                Choose your battle callsign before entering the Konbaung Royal Arena.
              </p>
              <form onSubmit={handleConfirmName} className="space-y-4">
                <input
                  type="text"
                  maxLength={20}
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="E.g. Alaungpaya, MahaBandula..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium text-sm"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNamePrompt(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!nameInput.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-bold text-sm transition-all cursor-pointer disabled:opacity-40"
                  >
                    Proceed ▶
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modals */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        <SocialModal
          isOpen={isSocialOpen}
          onClose={() => setIsSocialOpen(false)}
          playerName={playerName}
          onSaveName={(name) => {
            setPlayerName(name);
            localStorage.setItem('player-name', name);
          }}
        />
      </div>
    </div>
  );
};
