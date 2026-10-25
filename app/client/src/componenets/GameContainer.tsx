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
  type OpponentReconnectingPayload,
  type OpponentReconnectedPayload,
  type GameOverPayload,
  type RatingUpdateInfo,
  type YouEconomyPayload,
  type AttackerBufferPayload,
  type DeployRejectedPayload,
  type RoleAssignedPayload,
} from '@root/shared';
import { useGameRoom } from '../network/roomContext';
import { saveActiveMatch } from '../network/activeRoom';
import { setGuestElo } from '../auth/guest';
import { MatchLoadingScreen } from './match/MatchLoadingScreen';
import { GameHUD } from './game/GameHUD';
import { AttackerDeployBar } from './game/AttackerDeployBar';
import { MapRevealOverlay } from './game/MapRevealOverlay';
import { useSmoothCountdown } from './game/useSmoothCountdown';
import { DraftOverlay } from './game/DraftOverlay';
import { GameOverOverlay } from './game/GameOverOverlay';
import { SettingsModal } from './landing/SettingsModal';
import { AssetPreloader } from '../game/assetPreloader';

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
  ratingUpdate?: RatingUpdateInfo;
}

/** Safety net: return a finished match to the lobby after this idle timeout. */
const GAME_OVER_AUTO_RETURN_MS = 3 * 60 * 1000;

const MAP_IMAGE_URLS: Record<string, string> = {
  konbaung: '/assets/maps/map_1_konbaung/map.jpg',
  bagan: '/assets/maps/map_2_bagan/map.jpg',
  inle: '/assets/maps/map_3_inle/map.jpg',
  mandalay: '/assets/maps/map_4_mandalay/map.jpg',
  innwa: '/assets/maps/map_5_innwa/map.jpg',
  bago: '/assets/maps/map_6_bago/map.jpg',
  deserted: '/assets/maps/map_7_deserted/map.jpg',
  twister: '/assets/maps/map_8_twister/map.jpg',
  river: '/assets/maps/map_9_river/map.jpg',
};

type PlayerRole = "attacker" | "defender";

/** True when this client's own role is already authoritative on the schema. */
function hasOwnRole(room: Room): boolean {
  const role = room.state?.players?.get(room.sessionId)?.role as
    | PlayerRole
    | undefined;
  return role === "attacker" || role === "defender";
}

/** Seeds names/roles from the snapshot so a rejoin renders without a blank HUD. */
function playerInfoFromState(room: Room): PlayerInfo {
  const me = room.state?.players?.get(room.sessionId);
  let opponentName: string | undefined;
  let opponentRole: string | undefined;

  room.state?.players?.forEach((player: { name?: string; role?: string }, id: string) => {
    if (id !== room.sessionId) {
      opponentName = player.name;
      opponentRole = player.role || undefined;
    }
  });

  return {
    myName: me?.name,
    myRole: me?.role || undefined,
    opponentName,
    opponentRole,
  };
}

/**
 * Whether the snapshot already proves a match is past the waiting/pre-match
 * draft placeholder. `drafting` is deliberately excluded: a room opens in that
 * phase before the second player is ready, and rendering the draft UI from that
 * placeholder is what made the map reveal flash in after a phantom draft.
 */
function matchAlreadyStarted(room: Room): boolean {
  const phase = room.state?.phase as string | undefined;
  return (
    room.state?.players?.size === 2 &&
    hasOwnRole(room) &&
    phase !== undefined &&
    phase !== 'drafting' &&
    phase !== 'waiting'
  );
}

/**
 * Rebuilds the game-over screen from the synced snapshot. A rejoin after the
 * match closed never receives the one-shot `game_over` push, so without this
 * the board would render with no result overlay.
 */
function gameOverFromState(room: Room): GameOverInfo | null {
  if (room.state?.phase !== 'gameover') return null;
  const winner = room.state?.winner as PlayerRole | undefined;
  if (winner !== 'attacker' && winner !== 'defender') return null;

  const myRole = room.state.players.get(room.sessionId)?.role as PlayerRole | undefined;
  return {
    winner,
    reason: room.state.gameOverReason || 'surrender',
    youWin: winner === myRole,
  };
}

/**
 * Non-blocking notice shown to the player who stayed when their opponent's
 * socket drops. The match keeps running; the seats are held for the ticking
 * window, after which the opponent forfeits.
 */
const OpponentReconnectBanner: React.FC<{
  name: string;
  secondsRemaining: number;
}> = ({ name, secondsRemaining }) => {
  const seconds = useSmoothCountdown(secondsRemaining);
  if (seconds <= 0) return null;

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded-lg border border-amber-500/60 bg-slate-950/90 px-4 py-2 text-center shadow-xl backdrop-blur-sm">
        <p className="text-sm font-bold text-amber-200">
          {name} disconnected
        </p>
        <p className="text-xs text-slate-300">
          Reconnecting… <span className="font-mono font-bold text-white">{seconds}s</span> — they
          forfeit if they don't return.
        </p>
      </div>
    </div>
  );
};

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
  const [matchStarted, setMatchStarted] = useState<boolean>(() => matchAlreadyStarted(room));
  const [sceneReady, setSceneReady] = useState<boolean>(false);
  const [statusText, setStatusText] = useState(
    room.state?.players?.size === 2
      ? "Preparing the battlefield..."
      : "Waiting for opponent to join...",
  );
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>(() => playerInfoFromState(room));
  const [menuOpen, setMenuOpen] = useState(false);
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(() => gameOverFromState(room));

  // Gameplay HUD state
  const [gold, setGold] = useState<number>(200);
  const [incomeRate, setIncomeRate] = useState<number>(5);
  const [castleHp, setCastleHp] = useState<number>(() => room.state?.coreHp ?? MATCH_RULES.coreHp);
  const [deck, setDeck] = useState<string[]>([]);
  const [selectedTowerType, setSelectedTowerType] = useState<string>('basic');
  const [phase, setPhase] = useState<string>(() => room.state?.phase || 'drafting');
  const [phaseEndsAt, setPhaseEndsAt] = useState<number>(() => room.state?.phaseEndsAt ?? 0);
  const [mapId, setMapId] = useState<string>(() => room.state?.mapId || 'konbaung');
  const [maxCastleHp] = useState<number>(MATCH_RULES.coreHp);
  const [suddenDeath, setSuddenDeath] = useState<boolean>(() => !!room.state?.suddenDeath);

  // Attacker deploy-buffer state (attacker-only private pushes)
  const [buffer, setBuffer] = useState<AttackerBufferPayload | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [isUIHidden, setIsUIHidden] = useState<boolean>(false);
  const lastTapRef = useRef<number>(0);

  const handleContainerTap = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, [role="button"]')) return;
    if (target.closest('.tower-slot')) return;
    if (gameInstanceRef.current?.registry?.get('ui:overTowerSlot')) return;
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      setIsUIHidden((prev) => !prev);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Connection health: drives the reconnect/disconnect overlays. Mounted
  // mid-reconnect (e.g. a route change) must not masquerade as connected.
  const [connectionState, setConnectionState] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >(() => (room.reconnection.isReconnecting ? 'reconnecting' : 'connected'));

  // Set while the *opponent* is inside their reconnection window (we stay live).
  const [opponentReconnect, setOpponentReconnect] = useState<{
    name: string;
    seconds: number;
  } | null>(null);


  // Synchronize selected tower with newly drafted/updated deck
  useEffect(() => {
    if (deck && deck.length > 0 && !deck.includes(selectedTowerType)) {
      handleSelectTower(deck[0]);
    }
  }, [deck, selectedTowerType]);

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

  // Auto-dismiss a deploy refusal so the bar doesn't keep a stale message.
  useEffect(() => {
    if (!deployError) return;
    const timer = setTimeout(() => setDeployError(null), 2500);
    return () => clearTimeout(timer);
  }, [deployError]);

  // Room wiring: listeners + the ready handshake. Runs once per room; the
  // cleanup (including room.leave()) runs only when this component unmounts.
  useEffect(() => {
    // Match the SDK's retry budget to the server's 120s reconnection window.
    // The default budget (~56s) gives up long before the held seat expires,
    // so a backgrounded tab would be dropped for good.
    room.reconnection.maxRetries = 40;

    const offRoleAssigned = room.onMessage(
      MESSAGES.roleAssigned,
      (data: RoleAssignedPayload) => {
        console.log("Role assigned received:", data);
        setPlayerInfo({
          myName: data.myName,
          myRole: data.myRole,
          opponentName: data.opponentName,
          opponentRole: data.opponentRole,
        });
        // Apply the phase snapshot in the same batch as `matchStarted` so the
        // map reveal renders directly instead of a one-frame draft overlay.
        setPhase(data.phase);
        setPhaseEndsAt(data.phaseEndsAt);
        setMapId(data.mapId);
        if (data.mapId) {
          AssetPreloader.preloadMap(data.mapId);
        }
        if (data.phase === 'gameover') {
          setGameOver((prev) => prev ?? gameOverFromState(room));
        }
        setMatchStarted(true);
        setStatusText("Match Ready! Roles Assigned.");
      },
    );

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

    const offBuffer = room.onMessage(MESSAGES.attackerBuffer, (data: AttackerBufferPayload) => {
      setBuffer(data);
      setGold(data.gold);
      setDeployError(null);
    });

    // Attacker-only: a refused deploy intent, surfaced as a short-lived toast.
    const offDeployRejected = room.onMessage(
      MESSAGES.deployRejected,
      (data: DeployRejectedPayload) => {
        setDeployError(data.reason);
      },
    );

    // Tell the server the HUD is listening so it can safely send the role payload.
    room.send(MESSAGES.ready);

    const offOpponentLeft = room.onMessage(MESSAGES.opponentLeft, (data: OpponentLeftPayload) => {
      setGameOver(null);
      setPlayerInfo({});
      setMatchStarted(false);
      setStatusText(
        data.youAreHost
          ? "Waiting for opponent to join... (you are now the host)"
          : "Waiting for opponent to join...",
      );
      room.send(MESSAGES.ready);
    });

    // Opponent's socket dropped: keep playing, show their reconnect countdown.
    const offOpponentReconnecting = room.onMessage(
      MESSAGES.opponentReconnecting,
      (data: OpponentReconnectingPayload) => {
        setOpponentReconnect({ name: data.opponentName, seconds: data.secondsRemaining });
      },
    );

    const offOpponentReconnected = room.onMessage(
      MESSAGES.opponentReconnected,
      (_data: OpponentReconnectedPayload) => {
        setOpponentReconnect(null);
      },
    );

    const handleDrop = (code: number, reason?: string) => {
      console.warn('Connection dropped:', code, reason);
      setConnectionState('reconnecting');
    };
    const offDrop = room.onDrop(handleDrop);

    const handleReconnect = () => {
      console.log('Connection restored.');
      setConnectionState('connected');
      // The SDK rotates the reconnection token on every successful reconnect;
      // persist it so a later refresh still offers a valid resume.
      saveActiveMatch(room);
      // Re-sync from the full snapshot in case patches were missed while offline.
      setPhase(room.state.phase);
      setPhaseEndsAt(room.state.phaseEndsAt);
      setMapId(room.state.mapId);
      setPlayerInfo(playerInfoFromState(room));
      setCastleHp(room.state.coreHp);
      setSuddenDeath(!!room.state.suddenDeath);
      setGameOver((prev) => prev ?? gameOverFromState(room));
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
        ratingUpdate: payload.ratingUpdate,
      });

      if (payload.ratingUpdate?.newElo) {
        setGuestElo(payload.ratingUpdate.newElo);
      }
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
        if (p === "drafting") {
          setDeck([]);
        }
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

    const unlistenSuddenDeath = Callbacks.get(room).listen("suddenDeath", (active: boolean) => {
      setSuddenDeath(active);
    });

    // The pre-draft reveal shows whichever map the server rolled for the match.
    const unlistenMapId = Callbacks.get(room).listen("mapId", (id: string) => {
      setMapId(id);
      if (id) {
        AssetPreloader.preloadMap(id);
      }
    });

    return () => {
      offRoleAssigned();
      offEconomy();
      offBuffer();
      offDeployRejected();
      offOpponentLeft();
      offOpponentReconnecting();
      offOpponentReconnected();
      offDrop.remove(handleDrop);
      offReconnect.remove(handleReconnect);
      offLeave.remove(handleLeave);
      offGameOver();
      unlistenPhase();
      unlistenPhaseEndsAt();
      unlistenCoreHp();
      unlistenSuddenDeath();
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
        mode: Phaser.Scale.FIT,
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
    const effectiveRole = playerInfo.myRole || room.state?.players?.get(room.sessionId)?.role;
    game.registry.set('assignedRole', effectiveRole);
    game.registry.set('selectedTowerType', selectedTowerType);
    gameInstanceRef.current = game;

    const onSceneReady = () => {
      setSceneReady(true);
    };
    const onSceneShutdown = () => {
      setSceneReady(false);
    };
    game.events.on('scene-ready', onSceneReady);
    game.events.on('scene-shutdown', onSceneShutdown);

    return () => {
      game.events.off('scene-ready', onSceneReady);
      game.events.off('scene-shutdown', onSceneShutdown);
      setSceneReady(false);
      game.destroy(true);
      gameInstanceRef.current = null;
    };
  }, [room, matchStarted, playerInfo]);

  useEffect(() => {
    const role = (playerInfo.myRole || room.state?.players?.get(room.sessionId)?.role) as 'attacker' | 'defender' | undefined;
    if (gameInstanceRef.current && role) {
      gameInstanceRef.current.registry.set('assignedRole', role);
      const scene = gameInstanceRef.current.scene.getScene('GameScene') as any;
      if (scene?.setAssignedRole) {
        scene.setAssignedRole(role);
      }
    }
  }, [playerInfo.myRole, room]);

  /**
   * Bridges the deploy bar's drag hit-testing into the live Phaser scene.
   *
   * @returns The running gameplay scene, or `null` before it exists.
   */
  const getGameScene = (): GameScene | null => {
    const game = gameInstanceRef.current;
    if (!game || !game.scene.isActive('GameScene')) return null;
    return game.scene.getScene('GameScene') as GameScene | null;
  };

  /**
   * Full-screen status layer shown while the socket is dropped or gone. It
   * also swallows clicks, so a dead board can't look interactive.
   */
  const connectionOverlay = connectionState !== 'connected' && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
      {connectionState === 'reconnecting' ? (
        <div className="flex flex-col items-center gap-4 text-center animate-modalPop">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <div>
            <p className="text-lg font-bold text-white">Reconnecting…</p>
            <p className="text-xs text-slate-400">
              Hold on, restoring your match.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-6 text-center animate-modalPop">
          <h2 className="text-2xl font-bold text-white">Disconnected</h2>
          <p className="text-sm text-slate-400">
            We couldn't restore your connection to the match.
          </p>
          <button
            onClick={onLeaveRoom}
            className="mt-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition active:scale-95"
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


  const ambientBgUrl = (mapId && MAP_IMAGE_URLS[mapId]) || '/assets/maps/map_1_konbaung/map.jpg';

  return (
    <div onPointerDown={handleContainerTap} className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-950 flex items-center justify-center select-none">
      {/* Ambient map-aware backdrop bleed for widescreen devices */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-60 blur-xl scale-110 transition-opacity duration-700"
        style={{ backgroundImage: `url('${ambientBgUrl}')` }}
      />
      {/* Soft horizontal vignette so canvas seamlessly transitions into ambient bleed */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/60 via-transparent to-black/60 z-0" />

      {/* Phaser Canvas Container */}
      <div ref={gameRef} id="phaser-game" className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden" />

      {/* Pre-draft map reveal (covers the idle canvas while the map is shown) */}
      {matchStarted && phase === 'mapReveal' && (
        <MapRevealOverlay
          map={MAPS[mapId] ?? SAMPLE_MAP}
          serverSeconds={phaseEndsAt}
        />
      )}

      {/* Opponent reconnecting: informational, does not block play */}
      {matchStarted && !gameOver && opponentReconnect && (
        <OpponentReconnectBanner
          name={opponentReconnect.name}
          secondsRemaining={opponentReconnect.seconds}
        />
      )}

      {/* Royal Drafting Phase UI (covers the idle canvas while drafting) */}
      {matchStarted && phase === 'drafting' && (
        <DraftOverlay
          room={room}
          role={(playerInfo.myRole as 'attacker' | 'defender') || 'defender'}
          // `0` means the server has no draft timer (rules use `-1`), so let
          // the overlay keep its own per-round countdown instead of showing 0.
          serverSeconds={phaseEndsAt > 0 ? phaseEndsAt : undefined}
          onConfirm={(deck) => {
            room.send(MESSAGES.draftReady, { deck });
          }}
        />
      )}

      {/* Royal Game HUD Overlay */}
      {matchStarted && sceneReady && (phase === 'building' || phase === 'combat') && (
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
          isUIHidden={isUIHidden}
          onToggleUI={() => setIsUIHidden((prev) => !prev)}

          onStartBattle={() => {
            room.send(MESSAGES.startCombat, {});
          }}
        />
      )}

      {/* Attacker deploy bar (queue units, then push them through a portal) */}
      {matchStarted && sceneReady && !gameOver && playerInfo.myRole === 'attacker' && buffer &&
        (phase === 'building' || phase === 'combat') && (
        <AttackerDeployBar
          buffer={buffer}
          error={deployError}
          phase={phase}
          suddenDeath={suddenDeath}
          isUIHidden={isUIHidden}

          send={(type, payload) => room.send(type, payload)}
          findMapPortal={(x, y) => getGameScene()?.portalAtPage(x, y) ?? null}
          onMapPortalHover={(portalId) => getGameScene()?.setPortalHover(portalId)}
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-start justify-end p-4 animate-fadeIn"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-slideLeft"
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
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold text-white transition flex items-center justify-center gap-2 active:scale-95"
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
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-semibold text-slate-200 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <span>⛶</span> Toggle Fullscreen
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                setShowSettingsModal(true);
              }}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-semibold text-amber-200 transition flex items-center justify-center gap-2"
            >
              <span>⚙️</span> Audio & Settings
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                setSurrenderConfirm(true);
              }}
              className="py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold text-white transition active:scale-95"
            >
              Surrender
            </button>
          </div>
        </div>
      )}

      {/* Surrender Confirmation */}
      {surrenderConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl animate-modalPop max-w-sm w-full">
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Reconnect / disconnect status (above the board, blocks input) */}
      {connectionOverlay}
    </div>
  );
};