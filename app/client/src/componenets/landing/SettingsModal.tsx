import React, { useState } from 'react';
import { soundEffects } from '../../audio/soundEffects';
import { bgmManager } from '../../audio/bgmManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // Background Music State
  const [bgmVolume, setBgmVolumeState] = useState<number>(() => Math.round(bgmManager.getVolume() * 100));
  const [bgmMuted, setBgmMutedState] = useState<boolean>(() => bgmManager.getMuted());

  // Sound Effects State
  const [sfxVolume, setSfxVolumeState] = useState<number>(() => Math.round(soundEffects.getVolume() * 100));
  const [sfxMuted, setSfxMutedState] = useState<boolean>(() => soundEffects.getMuted());

  const [activeTab, setActiveTab] = useState<'audio' | 'guide'>('audio');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);
  const [effectsEnabled, setEffectsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('game:effects_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  if (!isOpen) return null;

  const handleEffectsToggle = () => {
    const next = !effectsEnabled;
    setEffectsEnabled(next);
    try {
      localStorage.setItem('game:effects_enabled', next ? 'true' : 'false');
    } catch {}
    window.dispatchEvent(new CustomEvent('settings:effects_toggle', { detail: { enabled: next } }));
    soundEffects.playHover();
  };

  // Music handlers
  const handleBgmVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setBgmVolumeState(newVol);
    bgmManager.setVolume(newVol / 100);
  };

  const handleBgmMuteToggle = () => {
    const next = !bgmMuted;
    setBgmMutedState(next);
    bgmManager.setMuted(next);
    soundEffects.playHover();
  };

  // Sound Effects handlers
  const handleSfxVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setSfxVolumeState(newVol);
    soundEffects.setVolume(newVol / 100);
  };

  const handleSfxMuteToggle = () => {
    const next = !sfxMuted;
    setSfxMutedState(next);
    soundEffects.setMuted(next);
    if (!next) {
      soundEffects.playHover();
    }
  };

  const handleTestSound = () => {
    soundEffects.playClick();
  };

  const handleFullscreenToggle = async () => {
    soundEffects.playHover();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen might be blocked
    }
  };

  const handleClose = () => {
    soundEffects.playModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900/95 border-2 border-amber-600/70 rounded-2xl shadow-[0_0_50px_rgba(217,119,6,0.3)] overflow-hidden text-white flex flex-col max-h-[92vh] animate-modalPop">
        {/* Ornate Gold Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-amber-400 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <h2 className="text-xl font-bold tracking-wider text-amber-300 font-serif">SETTINGS</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6">
          <button
            onClick={() => { soundEffects.playHover(); setActiveTab('audio'); }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'audio'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Audio & Display
          </button>
          <button
            onClick={() => { soundEffects.playHover(); setActiveTab('guide'); }}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            How To Play
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {activeTab === 'audio' ? (
            <>
              {/* Background Music Volume */}
              <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-sm font-medium">
                  <div className="flex items-center gap-2 text-slate-200">
                    <span>🎵</span>
                    <span>Background Music</span>
                  </div>
                  <span className="text-amber-400 font-mono">{bgmMuted ? 'Muted' : `${bgmVolume}%`}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bgmMuted ? 0 : bgmVolume}
                  disabled={bgmMuted}
                  onChange={handleBgmVolumeChange}
                  className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between items-center pt-1 text-xs">
                  <button
                    onClick={handleBgmMuteToggle}
                    className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      bgmMuted
                        ? 'bg-rose-950/50 border-rose-600 text-rose-300'
                        : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {bgmMuted ? '🔇 Unmute Music' : '🔈 Mute Music'}
                  </button>
                </div>
              </div>

              {/* Sound Effects Volume */}
              <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-sm font-medium">
                  <div className="flex items-center gap-2 text-slate-200">
                    <span>🔊</span>
                    <span>Sound Effects</span>
                  </div>
                  <span className="text-amber-400 font-mono">{sfxMuted ? 'Muted' : `${sfxVolume}%`}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sfxMuted ? 0 : sfxVolume}
                  disabled={sfxMuted}
                  onChange={handleSfxVolumeChange}
                  className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between items-center pt-1 text-xs">
                  <button
                    onClick={handleSfxMuteToggle}
                    className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      sfxMuted
                        ? 'bg-rose-950/50 border-rose-600 text-rose-300'
                        : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {sfxMuted ? '🔇 Unmute SFX' : '🔉 Mute SFX'}
                  </button>

                  <button
                    onClick={handleTestSound}
                    disabled={sfxMuted}
                    className="px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/50 hover:bg-amber-600/30 text-amber-300 font-semibold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                  >
                    ⚡ Test Sound
                  </button>
                </div>
              </div>

              {/* Link to Sound Studio */}
              <div className="flex justify-between items-center bg-slate-950/30 px-3.5 py-2.5 rounded-xl border border-slate-800/80">
                <div className="text-xs text-slate-400">
                  Audition tower firing sounds, test combos, or replace with custom audio
                </div>
                <a
                  href="/sounds"
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>🎧</span>
                  <span>Sound Studio</span>
                </a>
              </div>

              {/* Fullscreen Option */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Display Mode</div>
                    <div className="text-xs text-slate-400">Toggle full-screen immersion</div>
                  </div>
                  <button
                    onClick={handleFullscreenToggle}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-amber-300 transition-all cursor-pointer active:scale-95"
                  >
                    {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  </button>
                </div>
              </div>

              {/* Atmospheric Effects Overlay Option */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Atmospheric Effects</div>
                    <div className="text-xs text-slate-400">Cinematic vignette, embers & scanlines</div>
                  </div>
                  <button
                    onClick={handleEffectsToggle}
                    className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
                      effectsEnabled
                        ? 'bg-amber-600/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                    }`}
                  >
                    {effectsEnabled ? '✨ Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-2">
                  <span>⚔️</span> Attacker Role
                </h4>
                <p className="text-xs text-slate-300">
                  Draft aggressive warrior squads during the draft. In combat, march troops through the spawn portals to breach the Defender's Core!
                </p>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-2">
                  <span>🏰</span> Defender Role
                </h4>
                <p className="text-xs text-slate-300">
                  Select powerful archer, cannon, bell, and siege defense towers. Place them strategically onto the stone tower pads before hitting START GAME to stop the incoming invaders.
                </p>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-2">
                  <span>👑</span> Victory Condition
                </h4>
                <p className="text-xs text-slate-300">
                  Attacker wins by breaching the Base Core. Defender wins by holding out until the Siege Timer expires.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Ancient Burma TD v0.2.0</span>
          <span>Phaser 3 + Colyseus 0.18</span>
        </div>
      </div>
    </div>
  );
};
