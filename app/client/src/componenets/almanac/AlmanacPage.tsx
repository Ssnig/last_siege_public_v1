import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundEffects } from '../../audio/soundEffects';
import { GoldCrest } from '../lobby/LobbyOrnaments';
import { AlmanacTowersTab } from './AlmanacTowersTab';
import { AlmanacUnitsTab } from './AlmanacUnitsTab';
import { AlmanacMapsTab } from './AlmanacMapsTab';
import { AlmanacCodexTab } from './AlmanacCodexTab';

type AlmanacTab = 'towers' | 'units' | 'maps' | 'codex';

interface TabItem {
  id: AlmanacTab;
  label: string;
  icon: string;
  badge?: string;
}

const TABS: TabItem[] = [
  { id: 'codex', label: 'War Codex', icon: '📜', badge: 'Guide' },
  { id: 'towers', label: 'Towers', icon: '🏹', badge: '10' },
  { id: 'units', label: 'Units', icon: '⚔️', badge: '10' },
  { id: 'maps', label: 'Battlefields', icon: '🗺️', badge: '9' },
];

export const AlmanacPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AlmanacTab>('codex');

  const handleReturnToLobby = () => {
    soundEffects.playClick();
    navigate('/lobby');
  };

  const handleSelectTab = (tab: AlmanacTab) => {
    soundEffects.playClick();
    setActiveTab(tab);
  };

  return (
    <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden select-none bg-slate-950 text-white">
      {/* Background Ambience */}
      <img
        src="/assets/ui/bg2.jpg"
        alt="Almanac Background"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />
      <div className="absolute inset-0 backdrop-blur-[4px] bg-black/40 pointer-events-none" />

      {/* Main Full-Height Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-2 sm:px-6 h-[98vh] py-2 flex flex-col gap-2.5 animate-fadeIn">
        {/* ═══ Header Bar ═══ */}
        <div className="relative shrink-0">
          <GoldCrest />
          <div
            className="relative rounded-xl px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, #8c2e2c 0%, #6b1e1e 50%, #4a1212 100%)',
              border: '2px solid #c59b27',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(254,240,138,0.2)',
            }}
          >
            {/* Left: Back Button & Title */}
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
              <button
                onClick={handleReturnToLobby}
                onMouseEnter={() => soundEffects.playHover()}
                className="px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0"
                style={{
                  fontFamily: "'Almendra SC', 'Almendra', serif",
                  background: 'linear-gradient(180deg, #782220, #541414)',
                  border: '1.5px solid #c59b27',
                  color: '#fef3c7',
                  boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.2)',
                }}
              >
                <span>❮</span>
                <span className="hidden sm:inline">Lobby</span>
              </button>

              <div className="min-w-0">
                <h1
                  className="text-base sm:text-2xl font-bold text-amber-100 tracking-wider truncate uppercase font-['MedievalSharp',serif]"
                >
                  Royal Almanac & War Codex
                </h1>
                <p className="text-[10px] sm:text-xs text-amber-300/70 font-['Almendra',serif] truncate">
                  Authoritative Compendium of the Konbaung Dynasty
                </p>
              </div>
            </div>

            {/* Right: Tab Navigation Switchers */}
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-950/70 p-1 rounded-xl border border-amber-600/40 shrink-0">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    onMouseEnter={() => soundEffects.playHover()}
                    className={`px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-[1.02]'
                        : 'text-amber-200/70 hover:text-white hover:bg-slate-900/80'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden sm:inline font-['Almendra',serif]">{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? 'bg-slate-950 text-amber-300 font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ Main Tab Content Viewport ═══ */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === 'towers' && <AlmanacTowersTab />}
          {activeTab === 'units' && <AlmanacUnitsTab />}
          {activeTab === 'maps' && <AlmanacMapsTab />}
          {activeTab === 'codex' && <AlmanacCodexTab />}
        </div>
      </div>
    </div>
  );
};
