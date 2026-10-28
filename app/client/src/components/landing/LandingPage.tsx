import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundEffects } from '../../audio/soundEffects';
import { useAuth } from '../../auth/AuthContext';
import { SettingsModal } from './SettingsModal';
import { SocialModal } from './SocialModal';
import { prewarmServer } from '../../network/client';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    // Wake server container if cold-sleeping on cloud hosting
    prewarmServer();

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
    if (user) {
      navigate('/lobby');
      return;
    }
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
      {/* Expansive Ambient Background for Ultrawide Viewports */}
      <img
        src="/assets/ui/bg.jpg"
        alt=""
        aria-hidden="true"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none blur-sm opacity-50 scale-105"
      />
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

        {/* Top-Right Tutorial Academy Button */}
        <button
          onClick={() => {
            soundEffects.playClick();
            navigate('/tutorial');
          }}
          onMouseEnter={() => soundEffects.playHover()}
          className="absolute top-[3.5%] right-[12.8%] z-20 w-[4.5%] min-w-[36px] max-w-[60px] aspect-square flex items-center justify-center rounded-xl bg-slate-950/20 hover:bg-slate-950/40 backdrop-blur-xs border border-white/10 hover:border-amber-400/60 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200 cursor-pointer group active:scale-95"
          title="Royal War Academy (Tutorial)"
          aria-label="Tutorial"
        >
          <svg
            className="w-[55%] h-[55%] text-amber-300/80 group-hover:text-amber-300 transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
          </svg>
        </button>

        {/* Top-Right Almanac Codex Button */}
        <button
          onClick={() => {
            soundEffects.playClick();
            navigate('/almanac');
          }}
          onMouseEnter={() => soundEffects.playHover()}
          className="absolute top-[3.5%] right-[7.5%] z-20 w-[4.5%] min-w-[36px] max-w-[60px] aspect-square flex items-center justify-center rounded-xl bg-slate-950/20 hover:bg-slate-950/40 backdrop-blur-xs border border-white/10 hover:border-amber-400/60 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200 cursor-pointer group active:scale-95"
          title="Royal Almanac & War Codex"
          aria-label="Almanac"
        >
          <svg
            className="w-[55%] h-[55%] text-amber-300/80 group-hover:text-amber-300 transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
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

        {/* Center Logo & START Button Stack matching logo_and start_btn_placement_design.png */}
        <div className="absolute z-20 left-1/2 top-[7%] sm:top-[8%] md:top-[9%] -translate-x-1/2 flex flex-col items-center select-none pointer-events-none">
          {/* Official 'Last Siege' Game Logo */}
          <img
            src="/assets/logo/landing_logo_tight.png"
            alt="Last Siege"
            className="w-[38vw] min-w-[270px] max-w-[490px] h-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.65)]"
          />

          {/* Interactive Stone/Wood START Button */}
          <div
            className="relative -mt-2 sm:-mt-3 md:-mt-4 cursor-pointer group pointer-events-auto"
            onClick={handleStartClick}
            onMouseEnter={() => {
              setIsButtonHovered(true);
              soundEffects.playHover();
            }}
            onMouseLeave={() => setIsButtonHovered(false)}
          >
            {/* Amber bloom aura on hover */}
            <div
              className={`absolute inset-0 rounded-2xl bg-amber-400 blur-xl transition-all duration-300 ${
                isButtonHovered ? 'opacity-65 scale-105' : 'opacity-0 scale-95'
              }`}
            />

            <img
              src="/assets/logo/start_btn_tight.png"
              alt="START"
              className={`relative w-[18vw] min-w-[140px] max-w-[225px] h-auto object-contain transition-all duration-200 ease-out active:scale-95 ${
                isButtonHovered
                  ? 'scale-105 brightness-110 drop-shadow-[0_0_22px_rgba(251,191,36,0.85)]'
                  : 'scale-100 drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]'
              }`}
            />
          </div>
        </div>

        {/* First-Time Warrior Name Dialog Modal */}
        {showNamePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
            <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.35)] text-white animate-modalPop">
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
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium text-sm transition-all focus:ring-2 focus:ring-amber-500/30"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNamePrompt(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all cursor-pointer hover:text-white active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!nameInput.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-bold text-sm transition-all cursor-pointer disabled:opacity-40 active:scale-95 shadow-md hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]"
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
