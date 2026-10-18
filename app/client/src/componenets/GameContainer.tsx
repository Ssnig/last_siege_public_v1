// apps/client/src/components/GameContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Callbacks, Room } from '@colyseus/sdk';
import { GameScene } from '../game/GameScene';
import {
  MESSAGES,
  MATCH_RULES,
  MAPS,
  SAMPLE_MAP,
  type OpponentLeftPayload,
  type GameOverPayload,
  type YouEconomyPayload,
  type AttackerArmyPayload,
  type WaveRejectedPayload,
} from '@root/shared';
import { useGameRoom } from '../network/roomContext';
import { MatchLoadingScreen } from './match/MatchLoadingScreen';
import { GameHUD } from './game/GameHUD';
import { AttackerWavePanel } from './game/AttackerWavePanel';
import { MapRevealOverlay } from './game/MapRevealOverlay';
import { DraftOverlay } from './game/DraftOverlay';
import { GameOverOverlay } from './game/GameOverOverlay';

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
  const { setRoom } = useGameRoom();
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  /** Set right before our own `room.leave()` so the teardown leave is ignored. */
  const intentionalLeaveRef = useRef(false);

  // Pre-seeded from the snapshot so a joiner into a started room skips the wait.
  const [matchStarted, setMatchStarted] = useState<boolean>(
    () => room.state?.players?.size === 2 && hasOwnRole(room),
  );
  const [statusText, setStatusText] = useState("Waiting for opponent to join...");
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);

  // Gameplay HUD state
  const [gold, setGold] = useState<number>(200);
  const [incomeRate, setIncomeRate] = useState<number>(5);
  const [castleHp, setCastleHp] = useState<number>(() => room.state?.coreHp ?? MATCH_RULES.coreHp);
  const [deck, setDeck] = useState<string[]>([]);
  const [selectedTowerType, setSelectedTowerType] = useState<string>('basic');
  const [phase, setPhase] = useState<string>(() => room.state?.phase || 'drafting');
  const [phaseEndsAt, setPhaseEndsAt] = useState<number>(() => room.state?.phaseEndsAt || 180);
  const [mapId, setMapId] = useState<string>(() => room.state?.mapId || 'konbaung');
  const [maxCastleHp] = useState<number>(MATCH_RULES.coreHp);

  // Attacker wave-staging state (attacker-only private pushes)
  const [army, setArmy] = useState<AttackerArmyPayload | null>(null);
  const [waveError, setWaveError] = useState<string | null>(null);
  const [armyPanelOpen, setArmyPanelOpen] = useState(false);

  // Connection health: drives the reconnect/disconnect overlays.
  const [connectionState, setConnectionState] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('connected');

  const handleSelectTower = (id: string) => {
    setSelectedTowerType(id);
    if (gameInstanceRef.current) {
      gameInstanceRef.current.registry.set('selectedTowerType', id);
    }
  };

  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.registry.set('selectedTowerType', selectedTowerType);
    }
  }, [selectedTowerType]);

  // AFK fallback: if a finished match is left idle, return to the lobby.
  useEffect(() => {
    if (!gameOver) return;
    const timer = setTimeout(onLeaveRoom, GAME_OVER_AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [gameOver, onLeaveRoom]);

  // Auto-dismiss a wave refusal so the panel doesn't keep a stale message.
  useEffect(() => {
    if (!waveError) return;
    const timer = setTimeout(() => setWaveError(null), 2500);
    return () => clearTimeout(timer);
  }, [waveError]);

  // Room wiring: listeners + the ready handshake. Runs once per room; the
  // cleanup (including room.leave()) runs only when this component unmounts.
  useEffect(() => {
    // Match the SDK's retry budget to the server's 180s reconnection window.
    // The default budget (~56s) gives up long before the held seat expires,
    // so a backgrounded tab would be dropped for good.
    room.reconnection.maxRetries = 40;

    const offRoleAssigned = room.onMessage(MESSAGES.roleAssigned, (data) => {
      console.log("Role assigned received:", data);
      setPlayerInfo(data);
      setMatchStarted(true);
      setStatusText("Match Ready! Roles Assigned.");
    });

    const offEconomy = room.onMessage(MESSAGES.youEconomy, (data: YouEconomyPayload) => {
      console.log("GameContainer economy received:", data);
      setGold(data.gold);
      if (data.incomeRate !== undefined) {
        setIncomeRate(data.incomeRate);
      }
      if (data.deck && data.deck.length > 0) {
        setDeck(data.deck);
      }
    });

    const offArmy = room.onMessage(MESSAGES.attackerArmy, (data: AttackerArmyPayload) => {
      setArmy(data);
      setGold(data.gold);
      setWaveError(null);
    });

    // Attacker-only: a refused wave intent, surfaced as a short-lived toast.
    const offWaveRejected = room.onMessage(
      MESSAGES.waveRejected,
      (data: WaveRejectedPayload) => {
        setWaveError(data.reason);
      },
    );

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

    const handleDrop = (code: number, reason?: string) => {
      console.warn('Connection dropped:', code, reason);
      setConnectionState('reconnecting');
    };
    const offDrop = room.onDrop(handleDrop);

    const handleReconnect = () => {
      console.log('Connection restored.');
      setConnectionState('connected');
      // Re-send the ready handshake so the server re-pushes role/economy.
      room.send(MESSAGES.ready);
    };
    const offReconnect = room.onReconnect(handleReconnect);

    const handleLeave = (code: number, reason?: string) => {
      // Our own teardown (navigating away) calls `room.leave()`; ignore it.
      if (intentionalLeaveRef.current) return;
      console.warn('Connection lost:', code, reason);
      setStatusText('Connection Lost.');
      setConnectionState('disconnected');
    };
    const offLeave = room.onLeave(handleLeave);

    const offGameOver = room.onMessage(MESSAGES.gameOver, (payload: GameOverPayload) => {
      const myRole = room.state.players.get(room.sessionId)?.role;
      setGameOver({
        winner: payload.winner,
        reason: payload.reason,
        youWin: payload.winner === myRole,
      });
    });

    // Authoritative phase updates. `game_over` may arrive before or after this
    // patch (or never, when rejoining a match that already closed), so the
    // fallback reads the reason the server mirrored into `RoomState` instead of
    // guessing "surrender" — a normal core/time win would otherwise show a
    // phantom concession.
    const unlistenPhase = Callbacks.get(room).listen("phase", (p: string) => {
      setPhase(p);
      if (p !== "gameover") {
        setGameOver(null);
        return;
      }
      const winner = room.state.winner as "attacker" | "defender" | undefined;
      if (!winner) return;
      const myRole = room.state.players.get(room.sessionId)?.role;
      const reason = room.state.gameOverReason || "surrender";
      setGameOver((prev) => prev ?? { winner, reason, youWin: winner === myRole });
    });

    const unlistenPhaseEndsAt = Callbacks.get(room).listen("phaseEndsAt", (endsAt: number) => {
      setPhaseEndsAt(endsAt);
    });

    const unlistenCoreHp = Callbacks.get(room).listen("coreHp", (hp: number) => {
      setCastleHp(hp);
    });

    // The pre-draft reveal shows whichever map the server rolled for the match.
    const unlistenMapId = Callbacks.get(room).listen("mapId", (id: string) => {
      setMapId(id);
    });

    return () => {
      offRoleAssigned();
      offEconomy();
      offArmy();
      offWaveRejected();
      offOpponentLeft();
      offDrop.remove(handleDrop);
      offReconnect.remove(handleReconnect);
      offLeave.remove(handleLeave);
      offGameOver();
      unlistenPhase();
      unlistenPhaseEndsAt();
      unlistenCoreHp();
      unlistenMapId();
      // Mark this as an intentional leave so `onLeave` doesn't flip the UI
      // into the "disconnected" screen on the way out.
      intentionalLeaveRef.current = true;
      room.leave();
      // Drop the finished/left room from context so a later /game/:roomId
      // visit (e.g. via the browser back/forward) can never reuse it.
      setRoom((prev) => (prev === room ? null : prev));
    };
  }, [room, setRoom]);

  // Phaser lifecycle, keyed on whether the draft pick has begun.
  // ENVELOP scale mode fills widescreen displays edge-to-edge with no black bars.
  useEffect(() => {
    if (!matchStarted || !gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      backgroundColor: '#020617',
      parent: gameRef.current,
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      physics: { default: "arcade" },
      pixelArt: true,
      scene: [GameScene],
    };

    const game = new Phaser.Game(config);
    game.registry.set('room', room);
    game.registry.set('assignedRole', playerInfo.myRole);
    game.registry.set('selectedTowerType', selectedTowerType);
    gameInstanceRef.current = game;

    return () => {
      game.destroy(true);
      gameInstanceRef.current = null;
    };
  }, [room, matchStarted, playerInfo]);

  /**
   * Full-screen status layer shown while the socket is dropped or gone. It
   * also swallows clicks, so a dead board can't look interactive.
   */
  const connectionOverlay = connectionState !== 'connected' && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      {connectionState === 'reconnecting' ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <div>
            <p className="text-lg font-bold text-white">Reconnecting…</p>
            <p className="text-xs text-slate-400">
              Hold on, restoring your match.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <h2 className="text-2xl font-bold text-white">Disconnected</h2>
          <p className="text-sm text-slate-400">
            We couldn't restore your connection to the match.
          </p>
          <button
            onClick={onLeaveRoom}
            className="mt-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition"
          >
            Back to Lobby
          </button>
        </div>
      )}
    </div>
  );

  // Pre-match: no Phaser yet, render royal match waiting screen
  if (!matchStarted) {
    return (
      <>
        <MatchLoadingScreen
          room={room}
          statusText={statusText}
          onLeaveRoom={onLeaveRoom}
        />
        {connectionOverlay}
      </>
    );
  }


  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#020617] flex items-center justify-center">
      {/* Phaser Canvas Container (fullscreen ENVELOP) */}
      <div ref={gameRef} id="phaser-game" className="w-full h-full flex items-center justify-center overflow-hidden" />

      {/* Pre-draft map reveal (covers the idle canvas while the map is shown) */}
      {matchStarted && phase === 'mapReveal' && (
        <MapRevealOverlay
          map={MAPS[mapId] ?? SAMPLE_MAP}
          serverSeconds={phaseEndsAt}
        />
      )}

      {/* Royal Drafting Phase UI (covers the idle canvas while drafting) */}
      {matchStarted && phase === 'drafting' && (
        <DraftOverlay
          room={room}
          role={(playerInfo.myRole as 'attacker' | 'defender') || 'defender'}
          serverSeconds={phaseEndsAt}
          onConfirm={(deck) => {
            room.send(MESSAGES.draftReady, { deck });
          }}
        />
      )}

      {/* Royal Game HUD Overlay */}
      {matchStarted && (phase === 'building' || phase === 'combat') && (
        <GameHUD
          gold={gold}
          incomeRate={incomeRate}
          castleHp={castleHp}
          maxCastleHp={maxCastleHp}
          deck={deck}
          selectedTowerType={selectedTowerType}
          onSelectTower={handleSelectTower}
          onOpenMenu={() => setMenuOpen(true)}
          phase={phase}
          phaseEndsAt={phaseEndsAt}
          role={playerInfo.myRole as 'attacker' | 'defender'}
          onStartBattle={() => {
            room.send(MESSAGES.startCombat, {});
          }}
          onToggleArmy={
            playerInfo.myRole === 'attacker' ? () => setArmyPanelOpen((open) => !open) : undefined
          }
          armyOpen={armyPanelOpen}
        />
      )}

      {/* Attacker wave-staging panel (opened from the Army button next to gold) */}
      {matchStarted && !gameOver && playerInfo.myRole === 'attacker' && army && armyPanelOpen && (
        <AttackerWavePanel
          army={army}
          gold={gold}
          error={waveError}
          phase={phase}
          phaseEndsAt={phaseEndsAt}
          coreHp={castleHp}
          maxCoreHp={MATCH_RULES.coreHp}
          onClose={() => setArmyPanelOpen(false)}
          send={(type, payload) => room.send(type, payload)}
        />
      )}

      {/* Royal Konbaung Victory & Defeat Overlay */}
      {gameOver && (
        <GameOverOverlay
          gameOver={gameOver}
          room={room}
          onExit={onLeaveRoom}
          onRematch={() => {
            room.send(MESSAGES.rematch);
          }}
        />
      )}

      {/* Floating menu button (only during drafting phase before GameHUD takes over) */}
      {!gameOver && phase === 'drafting' && (
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

            {phase === 'building' && playerInfo.myRole === 'defender' && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  room.send(MESSAGES.startCombat, {});
                }}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold text-white transition flex items-center justify-center gap-2"
              >
                <span>⚔️</span> Start Combat Now
              </button>
            )}

            <button
              onClick={() => {
                try {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                  } else {
                    document.exitFullscreen();
                  }
                } catch {}
              }}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-semibold text-slate-200 transition flex items-center justify-center gap-2"
            >
              <span>⛶</span> Toggle Fullscreen
            </button>

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

      {/* Reconnect / disconnect status (above the board, blocks input) */}
      {connectionOverlay}
    </div>
  );
};