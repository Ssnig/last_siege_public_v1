// apps/client/src/components/GameContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Callbacks, Room } from '@colyseus/sdk';
import { GameScene } from '../game/GameScene';
import { MESSAGES, type OpponentLeftPayload, type GameOverPayload } from '@root/shared';

interface GameContainerProps {
  room: Room;
  onLeaveRoom: () => void;
}

interface PlayerInfo {
  myName?: string;
  myRole?: string;
  opponentName?: string;
  opponentRole?: string;
}

interface GameOverInfo {
  winner: string;
  reason: string;
  youWin: boolean;
}

/** Safety net: return a finished match to the lobby after this idle timeout. */
const GAME_OVER_AUTO_RETURN_MS = 3 * 60 * 1000;

type PlayerRole = "attacker" | "defender";

/** True when this client's own role is already authoritative on the schema. */
function hasOwnRole(room: Room): boolean {
  const role = room.state?.players?.get(room.sessionId)?.role as
    | PlayerRole
    | undefined;
  return role === "attacker" || role === "defender";
}

/**
 * Joins lifecycle: the Phaser canvas mounts only once both players are in
 * the draft pick (`role_assigned` received), so a solo host is never shown a
 * dead canvas. The room connection, message wiring and the ready handshake
 * live in their own effect; the Phaser game is created/destroyed in a second
 * effect keyed on `matchStarted`.
 *
 * The canvas fills the whole viewport (mobile-first); the only chrome is a
 * small floating menu button whose panel opens on tap and closes on backdrop.
 *
 * @remarks
 * Unmount (leaving to the lobby) destroys the game and calls `room.leave()`.
 */
export const GameContainer: React.FC<GameContainerProps> = ({ room, onLeaveRoom }) => {
  const gameRef = useRef<HTMLDivElement>(null);

  // Pre-seeded from the snapshot so a joiner into a started room skips the wait.
  const [matchStarted, setMatchStarted] = useState<boolean>(
    () => room.state?.players?.size === 2 && hasOwnRole(room),
  );
  const [statusText, setStatusText] = useState("Waiting for opponent to join...");
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);

  // AFK fallback: if a finished match is left idle, return to the lobby.
  useEffect(() => {
    if (!gameOver) return;
    const timer = setTimeout(onLeaveRoom, GAME_OVER_AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [gameOver, onLeaveRoom]);

  // Room wiring: listeners + the ready handshake. Runs once per room; the
  // cleanup (including room.leave()) runs only when this component unmounts.
  useEffect(() => {
    const offRoleAssigned = room.onMessage(MESSAGES.roleAssigned, (data) => {
      console.log("Role assigned received:", data);
      setPlayerInfo(data);
      setMatchStarted(true);
      setStatusText("Match Ready! Roles Assigned.");
    });

    // Tell the server the HUD is listening so it can safely send the role payload.
    room.send(MESSAGES.ready);

    const offOpponentLeft = room.onMessage(MESSAGES.opponentLeft, (data: OpponentLeftPayload) => {
      setPlayerInfo({});
      setMatchStarted(false);
      setStatusText(
        data.youAreHost
          ? "Waiting for opponent to join... (you are now the host)"
          : "Waiting for opponent to join...",
      );
      room.send(MESSAGES.ready);
    });

    const offLeave = room.onLeave(() => {
      setStatusText("Connection Lost.");
    });

    const offGameOver = room.onMessage(MESSAGES.gameOver, (payload: GameOverPayload) => {
      const myRole = room.state.players.get(room.sessionId)?.role;
      setGameOver({
        winner: payload.winner,
        reason: payload.reason,
        youWin: payload.winner === myRole,
      });
    });

    // Fallback: the authoritative phase patch also opens the game-over screen.
    const unlistenPhase = Callbacks.get(room).listen("phase", (phase: string) => {
      if (phase !== "gameover") return;
      const winner = room.state.winner as "attacker" | "defender" | undefined;
      if (!winner) return;
      const myRole = room.state.players.get(room.sessionId)?.role;
      setGameOver((prev) => prev ?? { winner, reason: "surrender", youWin: winner === myRole });
    });

    return () => {
      offRoleAssigned();
      offOpponentLeft();
      offLeave();
      offGameOver();
      unlistenPhase();
      room.leave();
    };
  }, [room]);

  // Phaser lifecycle, keyed on whether the draft pick has begun. RESIZE mode
  // makes the canvas track the viewport; the draft stages redeploy on RESIZE.
  useEffect(() => {
    if (!matchStarted || !gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#1e293b',
      parent: gameRef.current,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      physics: { default: "arcade" },
      pixelArt: true,
      scene: [GameScene],
    };

    const game = new Phaser.Game(config);
    game.registry.set('room', room);

    return () => {
      game.destroy(true);
    };
  }, [room, matchStarted]);

  // Pre-match: no Phaser yet, just a waiting screen.
  if (!matchStarted) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <h2 className="text-xl font-bold text-white">Match Lobby</h2>
          <p className="text-sm text-slate-400">{statusText}</p>
        </div>
        <button
          onClick={onLeaveRoom}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white transition"
        >
          Leave Room
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Phaser Canvas Container (fullscreen) */}
      <div ref={gameRef} id="phaser-game" className="absolute inset-0" />

      {/* Game-over screen (layered above the canvas) */}
      {gameOver && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <h2
              className={`text-4xl font-black tracking-tight ${
                gameOver.youWin ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {gameOver.youWin ? "Victory!" : "Defeat"}
            </h2>
            <p className="text-slate-300 text-sm">
              {gameOver.youWin
                ? "Your opponent surrendered."
                : "You surrendered."}
            </p>
            <p className="text-slate-500 text-xs">
              The enemy {gameOver.winner === "attacker" ? "Attacker" : "Defender"} wins.
            </p>
            <button
              onClick={onLeaveRoom}
              className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition"
            >
              Back to Lobby
            </button>
            <p className="text-slate-600 text-[11px]">
              Returning automatically in a few minutes if left idle.
            </p>
          </div>
        </div>
      )}

      {/* Floating menu button */}
      {!gameOver && (
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open game menu"
          className="absolute top-4 right-4 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-slate-900/80 border border-slate-700 text-white text-xl shadow-lg hover:bg-slate-800 active:scale-95 transition"
        >
          ☰
        </button>
      )}

      {/* Game menu: opens on tap, closes on backdrop click */}
      {!gameOver && menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-start justify-end p-4"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Game Menu</h3>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition"
              >
                ×
              </button>
            </div>

            {playerInfo.myRole && (
              <div className="flex flex-col gap-1 text-left bg-slate-800 p-3 rounded border border-slate-700 text-xs">
                <p>You: <span className="text-yellow-400 font-bold uppercase">{playerInfo.myRole}</span> — <span className="text-white font-bold">{playerInfo.myName}</span></p>
                <p>Opponent: <span className="text-yellow-400 font-bold uppercase">{playerInfo.opponentRole}</span> — <span className="text-white font-bold">{playerInfo.opponentName}</span></p>
              </div>
            )}

            <button
              onClick={() => {
                setMenuOpen(false);
                setSurrenderConfirm(true);
              }}
              className="py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold text-white transition"
            >
              Surrender
            </button>
          </div>
        </div>
      )}

      {/* Surrender Confirmation */}
      {surrenderConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 shadow-2xl">
            <p className="text-sm text-slate-200">Surrender the match? Your opponent will win.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSurrenderConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSurrenderConfirm(false);
                  room.send(MESSAGES.surrender);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition"
              >
                Confirm Surrender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};