// apps/client/src/components/GameContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Room } from '@colyseus/sdk';
import { GameScene } from '../game/GameScene';

interface GameContainerProps {
  room: Room;
  onLeaveRoom: () => void;
}

export const GameContainer: React.FC<GameContainerProps> = ({ room, onLeaveRoom }) => {
  const gameRef = useRef<HTMLDivElement>(null);

  // HUD Connection Testing State
  const [statusText, setStatusText] = useState<string>("Waiting for opponent to join...");
  const [playerInfo, setPlayerInfo] = useState<{
    myRole?: string;
    opponentName?: string;
    opponentRole?: string;
  }>({});

  useEffect(() => {
    if (!gameRef.current) return;

    // 1. Listen for Colyseus room messages
    room.onMessage("role_assigned", (data) => {
      console.log("Role assigned received:", data);
      setPlayerInfo(data);
      setStatusText("Match Ready! Roles Assigned.");
    });

    room.onLeave((code : any) => {
      setStatusText("Opponent disconnected or left room.");
    });

    // 2. Phaser Game Config
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
            <p>Your Role: <span className="text-yellow-400 font-bold uppercase">{playerInfo.myRole}</span></p>
            <p>Opponent: <span className="text-white font-bold">{playerInfo.opponentName}</span></p>
            <p>Opponent Role: <span className="text-yellow-400 font-bold uppercase">{playerInfo.opponentRole}</span></p>
          </div>
        )}

        <button
          onClick={onLeaveRoom}
          className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-bold transition"
        >
          Leave Room / Back to Lobby
        </button>
      </div>

      {/* Phaser Canvas Container */}
      <div ref={gameRef} id="phaser-game" className="border border-slate-800 shadow-2xl" />
    </div>
  );
};
