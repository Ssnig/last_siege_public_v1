import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAPS, mapDisplayName } from '@root/shared';
import type { RoleChoice, RoomStatus } from '@root/shared';
import type { Client, Room, RoomAvailable } from '@colyseus/sdk';
import { useGameRoom } from '../network/roomContext';
import { soundEffects } from '../audio/soundEffects';
import { clearActiveMatch, loadActiveMatch, type ActiveMatch } from '../network/activeRoom';
import { useAuth } from '../auth/AuthContext';
import { AuthModal } from '../auth/AuthModal';
import type { AuthUser } from '../auth/types';
import { GoldCrest, GoldDivider, RoyalPanel } from './lobby/LobbyOrnaments';
import { MapSelectorModal } from './match/MapSelectorModal';

interface LobbyProps {
  client: Client;
}

/** Account avatar with an initials fallback for users without a picture. */
const AccountAvatar: React.FC<{ user: AuthUser; className?: string }> = ({
  user,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (user.avatarUrl && !failed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-700 text-slate-950 font-bold ${className}`}
    >
      {user.name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
};

/** Reads a room's status, defaulting rooms created before the field existed to `"available"`. */
function roomStatusOf(room: RoomAvailable): RoomStatus {
  return room.metadata?.status === 'playing' ? 'playing' : 'available';
}

/**
 * Match lobby: nickname gate, live room browser, and room creation.
 * Royal crimson & gold filigree UI matching the Konbaung Dynasty art style.
 *
 * @remarks
 * Signed-in accounts supply the display name and avatar; guests fall back to
 * the nickname persisted in `localStorage` under `player-name`, so the name
 * prompt is skipped on return visits (the initial state is seeded lazily from
 * storage — no extra effect). Once past the gate it joins a `lobby` LobbyRoom:
 * `"rooms"` is the initial snapshot and `+` / `-` are realtime add/remove diffs.
 * The lobby connection is torn down on unmount.
 */
export const Lobby: React.FC<LobbyProps> = ({ client }) => {
  const { setRoom } = useGameRoom();
  const { user, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem('player-name') ?? '';
    } catch {
      return '';
    }
  });
  const [isNamed, setIsNamed] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('player-name')?.trim();
    } catch {
      return false;
    }
  });
  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [selectedRoleChoice, setSelectedRoleChoice] = useState<RoleChoice>("random");
  const [selectedMapId, setSelectedMapId] = useState<string>("konbaung");
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  /** A match this device still holds a seat in (seeded from storage so a hard refresh offers a reconnect). */
  const [resumable, setResumable] = useState<ActiveMatch | null>(() => loadActiveMatch());
  const [reconnecting, setReconnecting] = useState<boolean>(false);

  /** Signed-in accounts always take precedence over the locally stored guest name. */
  const effectiveName = user?.name?.trim() || name.trim() || 'Guest';
  const canEnterLobby = !!user || isNamed;

  /** Trims, persists the nickname, and moves past the name gate. No-op if blank. */
  const confirmName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    soundEffects.playClick();
    try {
      localStorage.setItem('player-name', trimmed);
    } catch {}
    setName(trimmed);
    setIsNamed(true);
  };


  useEffect(() => {
    if (!canEnterLobby) return;

    let lobbyRoom: Room;

    (async () => {
      try {
        lobbyRoom = await client.joinOrCreate("lobby");

        lobbyRoom.onMessage("rooms", (availableRooms) => {
          setRooms(availableRooms);
        });

        // "+" is an upsert: replace if we already track the room, else append.
        lobbyRoom.onMessage("+", ([roomId, room]) => {
          setRooms((prev) => {
            const index = prev.findIndex((r) => r.roomId === roomId);
            if (index === -1) return [...prev, room];
            const updated = [...prev];
            updated[index] = room;
            return updated;
          });
        });

        lobbyRoom.onMessage("-", (roomId) => {
          setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
        });
      } catch (e: any) {
        console.error("Failed to join lobby room:", e);
        setErrorMessage(e?.message || "Failed to connect to matchmaking server.");
      }
    })();


    return () => {
      if (lobbyRoom) {
        lobbyRoom.leave();
      }
    };
  }, [canEnterLobby]);

  /** Creates a `game_room` with the chosen role preference and enters the match. */
  const handleCreateRoom = async () => {
    soundEffects.playClick();
    setLoading(true);
    setErrorMessage(null);
    try {
      const room = await client.create("game_room", {
        playerName: effectiveName,
        roleChoice: selectedRoleChoice,
        mapId: selectedMapId,
      });
      setRoom(room);
      navigate(`/game/${room.roomId}`);
    } catch (e: any) {
      console.error("Error creating room:", e);
      setErrorMessage(e.message || "Failed to create room.");
      setLoading(false);
    }
  };

  /** Joins an existing room by id; surfaces an error if it's full or already closed. */
  const handleJoinRoom = async (roomId: string) => {
    soundEffects.playClick();
    setLoading(true);
    setErrorMessage(null);
    try {
      const room = await client.joinById(roomId, {
        playerName: effectiveName,
      });
      setRoom(room);
      navigate(`/game/${room.roomId}`);
    } catch (e: any) {
      console.error("Error joining room:", e);
      setErrorMessage(e.message || "Failed to join room. It may be full or closed.");
      setLoading(false);
    }
  };

  const handleChangeName = () => {
    soundEffects.playModal();
    setNameInput(effectiveName);
    setShowNameModal(true);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === effectiveName) {
      setShowNameModal(false);
      return;
    }
    soundEffects.playClick();

    if (user) {
      setErrorMessage(null);
      try {
        await updateProfile({ name: trimmed });
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to update your account name.',
        );
        return;
      }
    } else {
      try {
        localStorage.setItem('player-name', trimmed);
      } catch {}
      setName(trimmed);
    }

    setShowNameModal(false);
  };

  const handleSignOut = () => {
    soundEffects.playClick();
    // Keep the player in the lobby as a guest, reusing their account name if
    // no local guest name exists yet.
    if (!name.trim() && user) {
      const fallbackName = user.name.trim();
      setName(fallbackName);
      setIsNamed(true);
      try {
        localStorage.setItem('player-name', fallbackName);
      } catch {}
    }
    signOut();
  };

  /**
   * Re-enters the stored match.
   *
   * @remarks The server holds the seat for a fixed window, so a failure here
   * means it has expired: the stored token is dropped and the banner hidden.
   */
  const handleReconnect = async () => {
    if (!resumable) return;
    soundEffects.playClick();
    setReconnecting(true);
    setErrorMessage(null);
    try {
      const room = await client.reconnect(resumable.reconnectionToken);
      setRoom(room);
      navigate(`/game/${room.roomId}`);
    } catch (e: any) {
      console.error('Failed to reconnect:', e);
      clearActiveMatch();
      setResumable(null);
      setReconnecting(false);
      setErrorMessage('Your previous match is no longer available.');
    }
  };

  /** Forgets the stored match so the resume prompt stops appearing. */
  const handleDismissResume = () => {
    soundEffects.playModal();
    clearActiveMatch();
    setResumable(null);
  };

  // Available rooms lead; playing rooms trail as low-priority, still listed.
  const sortedRooms = [...rooms].sort(
    (a, b) =>
      Number(roomStatusOf(a) === 'playing') - Number(roomStatusOf(b) === 'playing'),
  );

  // ──── Step 1: Royal Name Entry Gate ────
  if (!canEnterLobby) {
    return (
      <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden select-none">
        {/* Background */}
        <img
          src="/assets/ui/bg2.jpg"
          alt="Battlefield"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
        <div className="absolute inset-0 backdrop-blur-[4px] bg-black/30 pointer-events-none" />

        <RoyalPanel className="relative z-10 w-full max-w-md p-4 sm:p-8 max-h-[94vh] overflow-y-auto">
          <div className="text-center mb-3 sm:mb-6">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-wide text-amber-200"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              Welcome, Warrior
            </h1>
            <p
              className="text-xs sm:text-sm text-amber-100/60 mt-0.5 sm:mt-1"
              style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
            >
              Enter your battle name to proceed
            </p>
          </div>
          <GoldDivider className="mb-3 sm:mb-6" />
          <input
            type="text"
            placeholder="Your Commander Name..."
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmName()}
            className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition text-sm sm:text-[15px]"
            style={{
              fontFamily: "'Almendra', 'Georgia', serif",
              fontSize: '15px',
              background: 'linear-gradient(135deg, #3f2719, #29180e)',
              border: '2px solid #785128',
            }}
          />
          <button
            disabled={!name.trim()}
            onClick={confirmName}
            onMouseEnter={() => soundEffects.playHover()}
            className="w-full mt-3 sm:mt-5 py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            style={{
              fontFamily: "'Almendra SC', 'Almendra', serif",
              background: 'linear-gradient(180deg, #10b981, #059669, #047857)',
              border: '2px solid #d4af37',
              color: '#fef3c7',
              boxShadow: '0 2px 10px rgba(5,150,105,0.4), inset 0 1px 0 rgba(254,240,138,0.3)',
            }}
          >
            Enter The Arena
          </button>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/50 to-amber-700/40" />
            <span
              className="text-[10px] uppercase tracking-[0.2em] text-amber-200/50"
              style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
            >
              or
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-600/50 to-amber-700/40" />
          </div>

          <button
            onClick={() => {
              soundEffects.playModal();
              setShowAuthModal(true);
            }}
            onMouseEnter={() => soundEffects.playHover()}
            className="w-full py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 cursor-pointer active:scale-[0.97] hover:brightness-110"
            style={{
              fontFamily: "'Almendra SC', 'Almendra', serif",
              background: 'linear-gradient(180deg, #8c2e2c, #6b1e1e)',
              border: '2px solid #c59b27',
              color: '#fef3c7',
              boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.2)',
            }}
          >
            Sign In / Create Account
          </button>
        </RoyalPanel>
      </div>
    );
  }

  // ──── Step 2: Main Lobby Browser & Creation ────
  return (
    <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <img
        src="/assets/ui/bg2.jpg"
        alt="Battlefield"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />
      <div className="absolute inset-0 backdrop-blur-[3px] bg-black/20 pointer-events-none" />

      {/* Main Content Frame */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-3 sm:px-6 flex flex-col gap-2 sm:gap-4 max-h-[96vh] sm:max-h-[90vh] overflow-y-auto">
        {/* ═══ Top Header Bar ═══ */}
        <div className="relative">
          <GoldCrest />
          <div
            className="relative rounded-lg px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, #8c2e2c 0%, #6b1e1e 50%, #4a1212 100%)',
              border: '2px solid #c59b27',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(254,240,138,0.15)',
            }}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Green status orb */}
              <div className="relative w-3.5 h-3.5 shrink-0">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                <div className="absolute inset-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-lg sm:text-xl font-bold text-amber-100 tracking-wide leading-tight"
                  style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
                >
                  Match Lobby
                </h2>
                <div className="flex items-center gap-1.5 min-w-0">
                  {user ? (
                    <AccountAvatar
                      key={user.id}
                      user={user}
                      className="w-5 h-5 text-[9px] shrink-0"
                    />
                  ) : (
                    <div
                      className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-amber-200/80"
                      style={{ background: 'rgba(41,24,14,0.8)', border: '1px solid rgba(197,155,39,0.4)' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21a8 8 0 0 1 16 0" />
                      </svg>
                    </div>
                  )}
                  <p
                    className="text-[11px] sm:text-xs text-amber-200/60 truncate"
                    style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                  >
                    {user ? (
                      <>
                        Signed in as{' '}
                        <span className="text-amber-300 font-semibold">{user.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-amber-300 font-semibold">Guest</span> · not signed in
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Header action buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                title="Toggle Fullscreen"
                className="px-2.5 py-1 sm:py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 text-amber-200"
                style={{
                  background: 'linear-gradient(180deg, #8c2e2c, #6b1e1e)',
                  border: '1.5px solid #c59b27',
                  boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.2)',
                }}
              >
                ⛶
              </button>
              <button
                onClick={handleChangeName}
                onMouseEnter={() => soundEffects.playHover()}
                className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95"
                style={{
                  fontFamily: "'Almendra SC', 'Almendra', serif",
                  background: 'linear-gradient(180deg, #8c2e2c, #6b1e1e)',
                  border: '2px solid #c59b27',
                  color: '#fef3c7',
                  boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.2)',
                }}
              >
                Change Name
              </button>
              {user ? (
                <button
                  onClick={handleSignOut}
                  onMouseEnter={() => soundEffects.playHover()}
                  className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 hover:brightness-110"
                  style={{
                    fontFamily: "'Almendra SC', 'Almendra', serif",
                    background: 'linear-gradient(180deg, #7f1d1d, #5c0f0f)',
                    border: '2px solid rgba(248,113,113,0.6)',
                    color: '#fecaca',
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => {
                    soundEffects.playModal();
                    setShowAuthModal(true);
                  }}
                  onMouseEnter={() => soundEffects.playHover()}
                  className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 hover:brightness-110"
                  style={{
                    fontFamily: "'Almendra SC', 'Almendra', serif",
                    background: 'linear-gradient(180deg, #10b981, #059669)',
                    border: '2px solid #d4af37',
                    color: '#fef3c7',
                    boxShadow: 'inset 0 1px 0 rgba(254,240,138,0.2)',
                  }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div
            className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
            style={{
              background: 'linear-gradient(135deg, #7f1d1d, #5c0f0f)',
              border: '1px solid #c59b27',
              color: '#fecaca',
              fontFamily: "'Almendra', 'Georgia', serif",
            }}
          >
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* ═══ Resume Match Banner ═══ */}
        {resumable && (
          <div
            className="relative rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{
              background: 'linear-gradient(135deg, #7a5410 0%, #5a3c0a 50%, #3d2906 100%)',
              border: '2px solid #d4af37',
              boxShadow: '0 4px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(254,240,138,0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-3.5 h-3.5 shrink-0">
                <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-40" />
                <div className="absolute inset-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
              </div>
              <div>
                <p
                  className="text-sm font-bold text-amber-100 tracking-wide"
                  style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
                >
                  You still have a game running.
                </p>
                <p
                  className="text-[11px] sm:text-xs text-amber-100/70"
                  style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                >
                  Reconnect to rejoin your match before your seat expires.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                onClick={handleDismissResume}
                onMouseEnter={() => soundEffects.playHover()}
                className="px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition cursor-pointer active:scale-95"
                style={{
                  fontFamily: "'Almendra SC', 'Almendra', serif",
                  background: 'linear-gradient(180deg, #6b1e1e, #4a1212)',
                  border: '1.5px solid rgba(197,155,39,0.6)',
                  color: '#fef3c7',
                }}
              >
                Dismiss
              </button>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                onMouseEnter={() => soundEffects.playHover()}
                className="px-4 py-1.5 rounded-md text-xs font-bold tracking-wider transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                style={{
                  fontFamily: "'Almendra SC', 'Almendra', serif",
                  background: 'linear-gradient(180deg, #10b981, #059669, #047857)',
                  border: '1.5px solid #d4af37',
                  color: '#fef3c7',
                  boxShadow: '0 2px 10px rgba(5,150,105,0.4)',
                }}
              >
                {reconnecting ? 'Reconnecting...' : 'Reconnect'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ Two Panel Grid ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1.9fr] gap-2.5 sm:gap-4 flex-1 min-h-0">

          {/* ─── Left Panel: Create Matchroom ─── */}
          <RoyalPanel className="flex flex-col p-3 sm:p-5">
            <h3
              className="text-sm sm:text-lg font-bold text-amber-100 tracking-wide mb-0.5 sm:mb-1"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              Create Matchroom
            </h3>
            <GoldDivider className="mb-1.5 sm:mb-4" />

            <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 justify-center">
              <label
                className="text-[11px] sm:text-xs font-bold text-amber-200/70 uppercase tracking-[0.15em]"
                style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
              >
                Role Preference
              </label>

              {/* Carved Wood Dropdown */}
              <div className="relative">
                <select
                  value={selectedRoleChoice}
                  onChange={(e) => {
                    soundEffects.playHover();
                    setSelectedRoleChoice(e.target.value as RoleChoice);
                  }}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-md text-xs sm:text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition pr-10"
                  style={{
                    fontFamily: "'Almendra', 'Georgia', serif",
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #3f2719, #29180e)',
                    border: '2px solid #785128',
                    color: '#ffebc3',
                  }}
                >
                  <option value="random">Randomized</option>
                  <option value="attacker">Attacker</option>
                  <option value="defender">Defender</option>
                </select>
                {/* Gold chevron */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 5L7 9L11 5" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Battlefield Selector Trigger */}
            <div className="mt-1.5 sm:mt-3">
              <label
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-1 block"
                style={{ fontFamily: "'Almendra', 'Cinzel', serif" }}
              >
                Battlefield
              </label>
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  setShowMapModal(true);
                }}
                className="w-full flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-amber-600/60 bg-slate-900/80 hover:bg-slate-800 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🗺️</span>
                  <div>
                    <div className="text-xs font-bold text-amber-200">
                      {mapDisplayName(selectedMapId)}
                    </div>
                    <div className="text-[10px] text-amber-400/70">
                      {MAPS[selectedMapId]
                        ? `${MAPS[selectedMapId].lanes || 2} ${(MAPS[selectedMapId].lanes || 2) === 1 ? 'Lane' : 'Lanes'}`
                        : 'Surprise pick'}{' '}
                      · Tap to Change
                    </div>
                  </div>
                </div>
                <span className="text-amber-400 text-xs font-bold">Change ❯</span>
              </button>
            </div>

            {/* Host New Match Button */}
            <button
              disabled={loading}
              onClick={handleCreateRoom}
              onMouseEnter={() => soundEffects.playHover()}
              className="w-full mt-2 sm:mt-5 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] hover:brightness-110"
              style={{
                fontFamily: "'Almendra SC', 'Almendra', serif",
                background: 'linear-gradient(180deg, #10b981 0%, #059669 50%, #047857 100%)',
                border: '2px solid #d4af37',
                color: '#fef3c7',
                boxShadow: '0 2px 12px rgba(5,150,105,0.4), inset 0 1px 0 rgba(254,240,138,0.3)',
              }}
            >
              {loading ? "Creating..." : "Host New Match"}
            </button>
          </RoyalPanel>

          {/* ─── Right Panel: Active Lobbies ─── */}
          <RoyalPanel className="flex flex-col p-3 sm:p-5 min-h-[160px] sm:min-h-0">
            <h3
              className="text-sm sm:text-lg font-bold text-amber-100 tracking-wide mb-0.5 sm:mb-1"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              Active Lobbies ({rooms.length})
            </h3>
            <GoldDivider className="mb-2 sm:mb-4" />

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
              {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <p
                    className="text-amber-200/50 text-sm italic"
                    style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                  >
                    No open matches found.
                  </p>
                  <p
                    className="text-amber-400/60 text-sm italic"
                    style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                  >
                    Host a room to start playing!
                  </p>
                </div>
              ) : (
                sortedRooms.map((room) => {
                  const status = roomStatusOf(room);
                  const isPlaying = status === 'playing';

                  return (
                    <div
                      key={room.roomId}
                      className={`flex items-center justify-between rounded-lg px-3 sm:px-4 py-2 sm:py-3 transition-all ${
                        isPlaying ? 'opacity-55' : 'hover:brightness-110'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, rgba(74,18,18,0.6), rgba(60,15,15,0.8))',
                        border: '1px solid rgba(197,155,39,0.35)',
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className="font-bold text-sm text-amber-100"
                            style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                          >
                            {room.metadata?.creatorName || 'Unknown'}'s Arena
                          </p>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              fontFamily: "'Almendra SC', 'Almendra', serif",
                              background: isPlaying
                                ? 'linear-gradient(180deg, #7f1d1d, #5c0f0f)'
                                : 'linear-gradient(180deg, #065f46, #064e3b)',
                              border: `1px solid ${isPlaying ? 'rgba(248,113,113,0.5)' : 'rgba(52,211,153,0.5)'}`,
                              color: isPlaying ? '#fecaca' : '#a7f3d0',
                            }}
                          >
                            {isPlaying ? 'Playing' : 'Available'}
                          </span>
                        </div>
                        <p
                          className="text-xs text-amber-300/50"
                          style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                        >
                          Preference:{' '}
                          <span className="text-amber-300 uppercase font-semibold">
                            {room.metadata?.roleChoice || 'random'}
                          </span>
                        </p>
                        <p
                          className="text-xs text-amber-300/50"
                          style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                        >
                          Map:{' '}
                          <span className="text-amber-300 font-semibold">
                            {mapDisplayName(room.metadata?.mapId)}
                          </span>
                        </p>
                      </div>
                      <button
                        disabled={loading || isPlaying}
                        onClick={() => handleJoinRoom(room.roomId)}
                        onMouseEnter={() => soundEffects.playHover()}
                        className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-md font-bold text-xs tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 hover:brightness-110"
                        style={{
                          fontFamily: "'Almendra SC', 'Almendra', serif",
                          background: isPlaying
                            ? 'linear-gradient(180deg, #4b5563, #374151)'
                            : 'linear-gradient(180deg, #10b981, #059669)',
                          border: '1.5px solid #d4af37',
                          color: '#fef3c7',
                          boxShadow: isPlaying
                            ? 'none'
                            : '0 1px 6px rgba(5,150,105,0.3)',
                        }}
                      >
                        {isPlaying ? 'In Progress' : loading ? 'Joining...' : 'Join Match'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </RoyalPanel>
        </div>
      </div>

      {/* ═══ Change Name Modal ═══ */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <RoyalPanel className="relative w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h3
                className="text-lg font-bold text-amber-100 tracking-wide"
                style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
              >
                {user ? 'Change Display Name' : 'Change Commander Name'}
              </h3>
              <button
                onClick={() => { soundEffects.playModal(); setShowNameModal(false); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-amber-300/60 hover:text-amber-200 transition cursor-pointer"
                style={{ background: 'rgba(74,18,18,0.6)', border: '1px solid rgba(197,155,39,0.3)' }}
              >
                ✕
              </button>
            </div>
            <GoldDivider className="mb-5" />

            <form onSubmit={handleSaveName} className="space-y-4">
              <input
                type="text"
                maxLength={40}
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="New Commander Name..."
                className="w-full px-4 py-3 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition text-sm"
                style={{
                  fontFamily: "'Almendra', 'Georgia', serif",
                  background: 'linear-gradient(135deg, #3f2719, #29180e)',
                  border: '2px solid #785128',
                }}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { soundEffects.playModal(); setShowNameModal(false); }}
                  onMouseEnter={() => soundEffects.playHover()}
                  className="flex-1 py-2.5 rounded-lg font-bold text-xs tracking-wider transition cursor-pointer active:scale-95"
                  style={{
                    fontFamily: "'Almendra SC', 'Almendra', serif",
                    background: 'linear-gradient(180deg, #6b1e1e, #4a1212)',
                    border: '2px solid rgba(197,155,39,0.5)',
                    color: '#fef3c7',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!nameInput.trim()}
                  onMouseEnter={() => soundEffects.playHover()}
                  className="flex-1 py-2.5 rounded-lg font-bold text-xs tracking-wider transition cursor-pointer active:scale-95 disabled:opacity-40"
                  style={{
                    fontFamily: "'Almendra SC', 'Almendra', serif",
                    background: 'linear-gradient(180deg, #10b981, #059669, #047857)',
                    border: '2px solid #d4af37',
                    color: '#fef3c7',
                    boxShadow: '0 2px 10px rgba(5,150,105,0.4)',
                  }}
                >
                  Save Name
                </button>
              </div>
            </form>
          </RoyalPanel>
        </div>
      )}

      {/* Account Sign In / Registration Modal */}
      {showAuthModal && (
        <AuthModal isOpen onClose={() => setShowAuthModal(false)} />
      )}

      {/* Battlefield Selector Modal */}
      <MapSelectorModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        selectedMapId={selectedMapId}
        onSelectMap={(mapId) => {
          setSelectedMapId(mapId);
          setShowMapModal(false);
          soundEffects.playClick();
        }}
      />
    </div>
  );
};
