import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundEffects } from '../../audio/soundEffects';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onSaveName: (name: string) => void;
}

export const SocialModal: React.FC<SocialModalProps> = ({
  isOpen,
  onClose,
  playerName,
  onSaveName,
}) => {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState<string>(playerName);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    soundEffects.playClick();
    onSaveName(trimmed);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleEnterLobby = () => {
    soundEffects.playClick();
    onClose();
    navigate('/lobby');
  };

  const handleClose = () => {
    soundEffects.playModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900/95 border-2 border-cyan-500/60 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden text-white flex flex-col">
        {/* Cyan Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-600 via-teal-300 to-cyan-600" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2 className="text-xl font-bold tracking-wider text-cyan-300 font-serif">WARRIOR PROFILE</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Nickname Form */}
          <form onSubmit={handleSave} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Warrior Nickname
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={20}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter player name..."
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm font-medium"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                Save
              </button>
            </div>
            {savedSuccess && (
              <p className="text-xs text-emerald-400 font-medium">✓ Nickname saved successfully!</p>
            )}
          </form>

          {/* Quick Multiplayer Status */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Matchmaking Server</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Online (Colyseus)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Game Mode</span>
              <span className="text-slate-200 font-medium">1v1 Attacker vs Defender</span>
            </div>
          </div>

          {/* Direct Lobby Action */}
          <button
            onClick={handleEnterLobby}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-black tracking-wide text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⚔️</span> GO TO MATCH LOBBY
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Rank: Recruit</span>
          <span>Region: Global</span>
        </div>
      </div>
    </div>
  );
};
