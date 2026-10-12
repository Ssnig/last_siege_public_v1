// apps/client/src/components/GameContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Room } from '@colyseus/sdk';
import { GameScene } from '../game/GameScene';
import { MESSAGES, type OpponentLeftPayload } from '@root/shared';

interface GameContainerProps {
  room: Room;
  onLeaveRoom: () => void;
}

/**
 * Mounts the Phaser canvas plus a debug HUD for the joined room.
 *
 * @remarks
 * The Room is passed to Phaser through `game.registry` (scenes aren't React
 * children), so read it in `GameScene.create()`. Unmount destroys the game and
 * calls `room.leave()` — don't also leave from a parent or you'll double-leave.
 */
export const GameContainer: React.FC<GameContainerProps> = ({ room, onLeaveRoom }) => {
  const gameRef = useRef<HTMLDivElement>(null);

  // HUD Connection Testing State
  const [statusText, setStatusText] = useState<string>("Waiting for opponent to join...");
  const [playerInfo, setPlayerInfo] = useState<{
    myName?: string;
    myRole?: string;
    opponentName?: string;
    opponentRole?: string;
  }>({});
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Mount Effect
  useEffect(() => {
    if (!gameRef.current) return;

    // Listen for Colyseus room messages
    room.onMessage(MESSAGES.roleAssigned, (data) => {
      console.log("Role assigned received:", data);
      setPlayerInfo(data);
      setStatusText("Match Ready! Roles Assigned.");
    });

    // Tell the server the HUD is listening so it can safely send the role payload.
    room.send(MESSAGES.ready);

    // opponent-left handler
    room.onMessage(MESSAGES.opponentLeft, (data: OpponentLeftPayload) => {
      setPlayerInfo({});

      setStatusText("Waiting for opponent to join...");
      if (data.youAreHost) {
        setToast(`You are now the host`);
        setTimeout(() => setToast(null), 3000);
      }
      room.send(MESSAGES.ready);
    });

    room.onLeave(() => {
      setStatusText("Connection Lost.");
    });

    // Phaser Game Config
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      backgroundColor: '#1e293b',
      parent: gameRef.current,
      physics: { default: "arcade" },
      pixelArt: true,
      scene: [GameScene],
    };

    const game = new Phaser.Game(config);
    game.registry.set('room', room);

    return () => {
      game.destroy(true);
      room.leave();
    };
  }, [room]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950">
      {/* Connection Test HUD Overlay */}
      <div className="absolute top-6 z-20 bg-slate-900/90 border border-slate-700 p-4 rounded-xl shadow-xl flex flex-col gap-2 min-w-[320px] text-center">
        <h3 className="font-bold text-lg text-blue-400">Connection & Role Debugger</h3>
        <p className="text-sm text-slate-300">{statusText}</p>

        {playerInfo.myRole && (
          <div className="flex flex-col gap-1 mt-2 text-left bg-slate-800 p-3 rounded border border-slate-700 text-xs">
            <p>Your Name: <span className="text-white font-bold">{playerInfo.myName}</span></p>
            <p>Your Role: <span className="text-yellow-400 font-bold uppercase">{playerInfo.myRole}</span></p>
            <p>Opponent: <span className="text-white font-bold">{playerInfo.opponentName}</span></p>
            <p>Opponent Role: <span className="text-yellow-400 font-bold uppercase">{playerInfo.opponentRole}</span></p>
          </div>
        )}

<button
          onClick={() => setLeaveConfirm(true)}
          className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-bold transition"
        >
          Leave Room
        </button>
      </div>

      {/* Phaser Canvas Container */}
      <div ref={gameRef} id="phaser-game" className="border border-slate-800 shadow-2xl" />

      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white px-4 py-2 rounded-full text-sm">
          {toast}
        </div>
      )}

      {/* Leave Confirmation */}
      {leaveConfirm && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 shadow-2xl">
            <p className="text-sm text-slate-200">Leave the match? This can't be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLeaveConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={onLeaveRoom}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition"
              >
                Confirm Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
