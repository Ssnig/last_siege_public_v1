import React, { useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { GoldCrest, GoldDivider, RoyalPanel } from '../lobby/LobbyOrnaments';
import { soundEffects } from '../../audio/soundEffects';
import { RankBadge } from '../rank/RankBadge';

interface MatchLoadingScreenProps {
  room: Room;
  statusText: string;
  onLeaveRoom: () => void;
}

/**
 * Royal Match Waiting Screen.
 * Replaces the generic blue spinner with an imperial Konbaung Dynasty
 * crimson & gold waiting room, room code copy button, and live status.
 */
export const MatchLoadingScreen: React.FC<MatchLoadingScreenProps> = ({
  room,
  statusText,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLink = () => {
    soundEffects.playClick();
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { });
  };

  return (
    <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden select-none animate-fadeIn">
      {/* Background with blur */}
      <img
        src="/assets/ui/bg2.webp"
        alt="Battlefield"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />
      <div className="absolute inset-0 backdrop-blur-[5px] bg-black/40 pointer-events-none" />

      {/* Main Waiting Frame */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        {/* Top Gold Crest */}
        <div className="relative">
          <GoldCrest />
        </div>

        <RoyalPanel className="p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl animate-modalPop shadow-[0_0_50px_rgba(212,175,55,0.35)]">
          {/* Animated Swords / Beacon */}
          {/* Animated Swords / Beacon */}
          <div className="relative w-16 h-16 mb-4 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-60" />

            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border-2 border-amber-400/50 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <svg
                className="w-7 h-7 text-amber-300 animate-pulse"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6-6" />
                <path d="M16 16l4 4" />
                <path d="M19 21l2-2" />
              </svg>
            </div>
          </div>

          <h2
            className="text-2xl font-bold text-amber-100 tracking-wide mb-1"
            style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
          >
            War Chamber
          </h2>

          <p
            className="text-xs text-amber-200/80 mb-4 animate-pulse font-medium"
            style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
          >
            {statusText}
          </p>

          <GoldDivider className="mb-4" />

          {/* Chamber Roster */}
          <div className="w-full mb-4 flex flex-col gap-2">
            {(() => {
              const roster: Array<{ sessionId: string; name: string; elo: number }> = [];
              if (room.state?.players?.forEach) {
                room.state.players.forEach((player: any, sessionId: string) => {
                  roster.push({
                    sessionId,
                    name: player.name || 'Anonymous',
                    elo: typeof player.elo === 'number' ? player.elo : 1000,
                  });
                });
              }
              return roster.map((player) => (
                <div
                  key={player.sessionId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-amber-900/50 text-left"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-amber-100 truncate">
                      {player.name} {player.sessionId === room.sessionId ? '(You)' : ''}
                    </span>
                  </div>
                  <RankBadge elo={player.elo} size="sm" showProgress={false} />
                </div>
              ));
            })()}
          </div>

          {/* Room ID Badge & Copy Invite */}
          <div
            className="w-full rounded-lg p-3 mb-5 flex flex-col gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(63,39,25,0.7), rgba(41,24,14,0.9))',
              border: '1.5px solid #785128',
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span
                className="text-amber-200/60 uppercase tracking-widest text-[10px]"
                style={{ fontFamily: "'Almendra SC', serif" }}
              >
                Arena Code
              </span>
              <span className="font-mono text-amber-300 font-bold tracking-wider">
                {room.roomId}
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              onMouseEnter={() => soundEffects.playHover()}
              className="w-full py-1.5 px-3 rounded-md text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              style={{
                fontFamily: "'Almendra SC', serif",
                background: copied
                  ? 'linear-gradient(180deg, #10b981, #059669)'
                  : 'linear-gradient(180deg, #8c2e2c, #6b1e1e)',
                border: '1px solid #c59b27',
                color: '#fef3c7',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Invite Link Copied!' : 'Copy Invite Link'}</span>
            </button>
          </div>

          {/* Leave Room Button */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onLeaveRoom();
            }}
            onMouseEnter={() => soundEffects.playHover()}
            className="px-6 py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 hover:brightness-110"
            style={{
              fontFamily: "'Almendra SC', 'Almendra', serif",
              background: 'linear-gradient(180deg, #7f1d1d, #5c0f0f)',
              border: '1.5px solid #c59b27',
              color: '#fecaca',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            Leave Arena
          </button>
        </RoyalPanel>
      </div>
    </div>
  );
};
