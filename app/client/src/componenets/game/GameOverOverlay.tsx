// app/client/src/componenets/game/GameOverOverlay.tsx
import React, { useEffect, useState } from 'react';
import { Room } from '@colyseus/sdk';
import { MESSAGES, type RematchUpdatePayload } from '@root/shared';

export interface GameOverOverlayProps {
  gameOver: {
    winner: string;
    reason: string;
    youWin: boolean;
  };
  room: Room;
  onExit: () => void;
  onRematch?: () => void;
}

/**
 * Pixel-art / Royal Burmese Burnished Gold Corner Flourish
 */
const CornerFlourish: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({ position }) => {
  const getStyles = () => {
    switch (position) {
      case 'tl':
        return 'top-1.5 left-1.5';
      case 'tr':
        return 'top-1.5 right-1.5 rotate-90';
      case 'bl':
        return 'bottom-1.5 left-1.5 -rotate-90';
      case 'br':
        return 'bottom-1.5 right-1.5 rotate-180';
    }
  };

  return (
    <div className={`absolute pointer-events-none z-10 w-6 h-6 sm:w-8 sm:h-8 ${getStyles()}`}>
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        <path d="M2 2 L14 2 L14 6 L6 6 L6 14 L2 14 Z" fill="#d4af37" />
        <path d="M4 4 L12 4 L12 6 L6 6 L6 12 L4 12 Z" fill="#ffe066" />
        <rect x="7" y="7" width="4" height="4" fill="#f59e0b" />
        <rect x="2" y="14" width="2" height="6" fill="#8a661b" />
        <rect x="14" y="2" width="6" height="2" fill="#8a661b" />
        <circle cx="9" cy="9" r="1.5" fill="#fff5d6" />
      </svg>
    </div>
  );
};

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  gameOver,
  room,
  onExit,
  onRematch,
}) => {
  // 16:9 Virtual viewport scale factor for responsive presentation on all devices
  const [viewportScale, setViewportScale] = useState<number>(1);

  // Rematch status tracking
  const [hasVotedRematch, setHasVotedRematch] = useState<boolean>(false);
  const [rematchVotes, setRematchVotes] = useState<number>(0);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState<boolean>(false);

  useEffect(() => {
    const updateScale = () => {
      // 1260x700 virtual canvas scale-to-fit
      const availableWidth = window.innerWidth;
      const availableHeight = window.innerHeight;
      const scaleX = availableWidth / 1260;
      const scaleY = availableHeight / 700;
      const fit = Math.min(scaleX, scaleY);
      setViewportScale(Math.max(0.15, fit));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, []);

  // Listen for rematch update messages from server
  useEffect(() => {
    if (!room) return;

    const offRematch = room.onMessage(
      MESSAGES.rematchUpdate,
      (payload: RematchUpdatePayload) => {
        setRematchVotes(payload.votes);
        if (payload.requesterSessionId !== room.sessionId) {
          setOpponentWantsRematch(true);
        }
      },
    );

    return () => {
      offRematch();
    };
  }, [room]);

  const handleRematchClick = () => {
    if (hasVotedRematch) return;
    setHasVotedRematch(true);
    setRematchVotes((prev) => Math.max(1, prev + 1));
    if (onRematch) {
      onRematch();
    } else {
      room.send(MESSAGES.rematch);
    }
  };

  // Determine descriptive victory/defeat reason copy
  const reasonText = (() => {
    if (gameOver.reason === 'core') {
      return gameOver.youWin
        ? 'The enemy base has been completely annihilated!'
        : 'Your royal fortress has fallen to the enemy!';
    }
    if (gameOver.reason === 'time') {
      return gameOver.youWin
        ? 'The royal defense held firm until enemy forces were depleted!'
        : 'Your invading forces were exhausted against the stronghold!';
    }
    if (gameOver.reason === 'surrender') {
      return gameOver.youWin
        ? 'Your adversary conceded and surrendered the battlefield.'
        : 'You surrendered the field of battle.';
    }
    return gameOver.youWin
      ? 'A glorious victory has been claimed in the royal realm!'
      : 'Defeated in battle! Regroup and fight again.';
  })();

  const logoSrc = gameOver.youWin ? '/assets/logo/Victory.png' : '/assets/logo/Defeat.png';

  return (
    <div
      className="fixed inset-0 z-50 w-full h-[100dvh] overflow-hidden flex items-center justify-center select-none bg-black/85 backdrop-blur-sm text-[#fff5d6]"
      style={{
        fontFamily: "'Cinzel', 'MedievalSharp', serif",
      }}
    >
      {/* 16:9 Scale-to-Fit Canvas Frame */}
      <div
        className="relative w-[1260px] h-[700px] shrink-0 origin-center transition-transform duration-75 flex flex-col items-center justify-between rounded-2xl overflow-hidden p-6 sm:p-8"
        style={{
          transform: `scale(${viewportScale})`,
          background: 'radial-gradient(ellipse at center, #7a1218 0%, #4a090e 55%, #1e0407 100%)',
          border: '3px solid #d4af37',
          boxShadow: '0 0 0 2px #420b0e, 0 0 50px rgba(0,0,0,0.95), inset 0 0 60px rgba(0,0,0,0.85)',
          WebkitTextSizeAdjust: '100%',
        }}
      >
        {/* Ornate Burnished Gold Corner Flourishes */}
        <CornerFlourish position="tl" />
        <CornerFlourish position="tr" />
        <CornerFlourish position="bl" />
        <CornerFlourish position="br" />

        {/* Decorative Top Border Accent Line */}
        <div className="w-3/4 max-w-xl h-1 bg-gradient-to-r from-transparent via-[#ffe066] to-transparent shadow-[0_0_10px_rgba(255,224,102,0.8)] opacity-80 mt-2" />

        {/* Centerpiece: Victory / Defeat Logo with Radiant Aura */}
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 min-h-0 py-2">
          {/* Main Logo Image */}
          <div className="relative flex items-center justify-center">
            {/* Glowing Backdrop Aura */}
            <div
              className={`absolute -inset-6 rounded-full blur-2xl opacity-70 pointer-events-none transition-all duration-1000 ${
                gameOver.youWin
                  ? 'bg-amber-400/50 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse'
                  : 'bg-red-800/40 shadow-[0_0_50px_rgba(220,38,38,0.5)]'
              }`}
            />

            <img
              src={logoSrc}
              alt={gameOver.youWin ? 'Victory' : 'Defeat'}
              className={`relative z-10 max-h-[260px] sm:max-h-[310px] w-auto max-w-[85vw] object-contain transition-transform duration-300 transform hover:scale-[1.02] ${
                gameOver.youWin
                  ? 'drop-shadow-[0_0_35px_rgba(255,224,102,0.85)] filter'
                  : 'drop-shadow-[0_0_30px_rgba(185,28,28,0.75)] filter'
              }`}
              onError={(e) => {
                // Fallback styled text title if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Subtitle / Reasonplate Banner */}
          <div
            className="relative px-6 py-2 rounded-lg text-center max-w-2xl flex flex-col items-center"
            style={{
              background: 'linear-gradient(90deg, rgba(30,5,8,0.4) 0%, rgba(66,11,14,0.9) 50%, rgba(30,5,8,0.4) 100%)',
              borderTop: '1px solid #d4af37',
              borderBottom: '1px solid #d4af37',
            }}
          >
            <p
              className="text-base sm:text-lg md:text-xl font-bold tracking-wide text-[#fff5d6]"
              style={{ textShadow: '2px 2px 2px #000' }}
            >
              {reasonText}
            </p>
            <p className="text-xs text-[#fce38a]/80 mt-0.5 tracking-wider uppercase font-semibold">
              The {gameOver.winner === 'attacker' ? 'Attacker' : 'Defender'} emerged triumphant.
            </p>
          </div>

          {/* Rematch Notification Banner if Opponent requested */}
          {opponentWantsRematch && !hasVotedRematch && (
            <div className="px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs sm:text-sm font-black animate-bounce shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              ⚔️ Your opponent wants a rematch! Click "RE MATCH" to accept!
            </div>
          )}
        </div>

        {/* Decorative Bottom Divider Line */}
        <div className="w-3/4 max-w-xl h-1 bg-gradient-to-r from-transparent via-[#ffe066] to-transparent shadow-[0_0_10px_rgba(255,224,102,0.8)] opacity-80 mb-2" />

        {/* Bottom Action Buttons: "RE MATCH" & "EXIT" */}
        <div className="w-full max-w-xl grid grid-cols-2 gap-4 sm:gap-6 pb-2">
          {/* "RE MATCH" Button */}
          <button
            type="button"
            onClick={handleRematchClick}
            disabled={hasVotedRematch}
            className={`group relative py-3.5 sm:py-4 px-6 rounded-xl font-black tracking-widest text-base sm:text-lg transition-all duration-200 overflow-hidden flex items-center justify-center ${
              hasVotedRematch
                ? 'bg-gradient-to-r from-emerald-950 via-emerald-800 to-emerald-950 border-2 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-default'
                : opponentWantsRematch
                  ? 'bg-gradient-to-r from-[#15803d] via-[#22c55e] to-[#15803d] border-2 border-[#ffe066] text-[#fff5d6] shadow-[0_0_25px_rgba(255,224,102,0.8)] hover:brightness-110 active:scale-95 cursor-pointer animate-pulse'
                  : 'bg-gradient-to-r from-[#166534] via-[#15803d] to-[#166534] border-2 border-[#ffe066] text-[#fff5d6] shadow-[0_0_20px_rgba(255,224,102,0.5)] hover:brightness-110 active:scale-95 cursor-pointer'
            }`}
            style={{ textShadow: '2px 2px 0px #000' }}
          >
            <CornerFlourish position="tl" />
            <CornerFlourish position="tr" />
            <CornerFlourish position="bl" />
            <CornerFlourish position="br" />

            <span className="flex items-center gap-2">
              {hasVotedRematch ? (
                <>
                  <span>⏳ REMATCH OFFERED</span>
                  <span className="text-emerald-300">({rematchVotes}/2)</span>
                </>
              ) : opponentWantsRematch ? (
                <>
                  <span>⚔️ ACCEPT REMATCH!</span>
                  <span className="text-amber-200">({rematchVotes}/2)</span>
                </>
              ) : (
                <span>⚔️ RE MATCH</span>
              )}
            </span>
          </button>

          {/* "EXIT" Button */}
          <button
            type="button"
            onClick={onExit}
            className="group relative py-3.5 sm:py-4 px-6 rounded-xl font-black tracking-widest text-base sm:text-lg transition-all duration-200 overflow-hidden flex items-center justify-center bg-gradient-to-r from-[#4a0d11] via-[#7a1218] to-[#4a0d11] border-2 border-[#d4af37] text-[#fce38a] shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:brightness-125 hover:border-[#ffe066] active:scale-95 cursor-pointer"
            style={{ textShadow: '2px 2px 0px #000' }}
          >
            <CornerFlourish position="tl" />
            <CornerFlourish position="tr" />
            <CornerFlourish position="bl" />
            <CornerFlourish position="br" />

            <span className="flex items-center gap-2">
              <span>🚪 EXIT</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
