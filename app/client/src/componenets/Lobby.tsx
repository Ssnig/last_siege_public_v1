import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoleChoice } from '@root/shared';
import type { Client, Room, RoomAvailable } from '@colyseus/sdk';
import { useGameRoom } from '../network/roomContext';
import { soundEffects } from '../audio/soundEffects';
import { GoldCrest, GoldDivider, RoyalPanel } from './lobby/LobbyOrnaments';

interface LobbyProps {
  client: Client;
}

/**
 * Match lobby: nickname gate, live room browser, and room creation.
 * Royal crimson & gold filigree UI matching the Konbaung Dynasty art style.
 *
 * @remarks
 * The nickname is persisted in `localStorage` under `player-name`, so the name
 * prompt is skipped on return visits (the initial state is seeded lazily from
 * storage — no extra effect). Once past the gate it joins a `lobby` LobbyRoom:
 * `"rooms"` is the initial snapshot and `+` / `-` are realtime add/remove diffs.
 * The lobby connection is torn down on unmount.
 */
export const Lobby: React.FC<LobbyProps> = ({ client }) => {
  const { setRoom } = useGameRoom();
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
      return !!localStorage.getItem('player-name');
    } catch {
      return false;
    }
  });
  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [selectedRoleChoice, setSelectedRoleChoice] = useState<RoleChoice>("random");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');

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
    if (!isNamed) return;

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
  }, [isNamed]);

  /** Creates a `game_room` with the chosen role preference and enters the match. */
  const handleCreateRoom = async () => {
    soundEffects.playClick();
    setLoading(true);
    setErrorMessage(null);
    try {
      const room = await client.create("game_room", {
        playerName: name,
        roleChoice: selectedRoleChoice,
        mapId: "konbaung",
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
        playerName: name,
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
    setNameInput(name);
    setShowNameModal(true);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    soundEffects.playClick();
    localStorage.setItem('player-name', trimmed);
    setName(trimmed);
    setShowNameModal(false);
  };

  // ──── Step 1: Royal Name Entry Gate ────
  if (!isNamed) {
    return (
      <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden select-none">
        {/* Background */}
        <img
          src="/assets/ui/bg2.jpg"
          alt="Battlefield"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
        <div className="absolute inset-0 backdrop-blur-[4px] bg-black/30 pointer-events-none" />

        <RoyalPanel className="relative z-10 w-full max-w-md p-8">
          <div className="text-center mb-6">
            <h1
              className="text-3xl font-bold tracking-wide text-amber-200"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              Welcome, Warrior
            </h1>
            <p
              className="text-sm text-amber-100/60 mt-1"
              style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
            >
              Enter your battle name to proceed
            </p>
          </div>
          <GoldDivider className="mb-6" />
          <input
            type="text"
            placeholder="Your Commander Name..."
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmName()}
            className="w-full px-4 py-3 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
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
            className="w-full mt-5 py-3 rounded-lg font-bold text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
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
      <div className="relative z-10 w-full max-w-5xl mx-auto px-3 sm:px-6 flex flex-col gap-2.5 sm:gap-4 max-h-[96vh] sm:max-h-[90vh]">
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
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Green status orb */}
              <div className="relative w-3.5 h-3.5 shrink-0">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                <div className="absolute inset-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              </div>
              <div>
                <h2
                  className="text-lg sm:text-xl font-bold text-amber-100 tracking-wide leading-tight"
                  style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
                >
                  Match Lobby
                </h2>
                <p
                  className="text-[11px] sm:text-xs text-amber-200/60"
                  style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                >
                  Commander: <span className="text-amber-300 font-semibold">{name}</span>
                </p>
              </div>
            </div>

            {/* Header action buttons */}
            <div className="flex items-center gap-2">
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

        {/* ═══ Two Panel Grid ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.8fr] gap-3 sm:gap-4 flex-1 min-h-0">

          {/* ─── Left Panel: Create Matchroom ─── */}
          <RoyalPanel className="flex flex-col p-3.5 sm:p-5">
            <h3
              className="text-base sm:text-lg font-bold text-amber-100 tracking-wide mb-1"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              Create Matchroom
            </h3>
            <GoldDivider className="mb-2 sm:mb-5" />

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
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-md text-xs sm:text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition pr-10"
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

            {/* Host New Match Button */}
            <button
              disabled={loading}
              onClick={handleCreateRoom}
              onMouseEnter={() => soundEffects.playHover()}
              className="w-full mt-3 sm:mt-5 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] hover:brightness-110"
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
          <RoyalPanel className="flex flex-col p-3.5 sm:p-5 min-h-[180px] md:min-h-0">
            <h3
              className="text-base sm:text-lg font-bold text-amber-100 tracking-wide mb-1"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              Active Lobbies ({rooms.length})
            </h3>
            <GoldDivider className="mb-4" />

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
                rooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="flex items-center justify-between rounded-lg px-4 py-3 transition-all hover:brightness-110"
                    style={{
                      background: 'linear-gradient(135deg, rgba(74,18,18,0.6), rgba(60,15,15,0.8))',
                      border: '1px solid rgba(197,155,39,0.35)',
                    }}
                  >
                    <div>
                      <p
                        className="font-bold text-sm text-amber-100"
                        style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                      >
                        {room.metadata?.creatorName || 'Unknown'}'s Arena
                      </p>
                      <p
                        className="text-xs text-amber-300/50"
                        style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
                      >
                        Preference:{' '}
                        <span className="text-amber-300 uppercase font-semibold">
                          {room.metadata?.roleChoice || 'random'}
                        </span>
                      </p>
                    </div>
                    <button
                      disabled={loading}
                      onClick={() => handleJoinRoom(room.roomId)}
                      onMouseEnter={() => soundEffects.playHover()}
                      className="px-5 py-2 rounded-md font-bold text-xs tracking-wider transition-all cursor-pointer disabled:opacity-50 active:scale-95 hover:brightness-110"
                      style={{
                        fontFamily: "'Almendra SC', 'Almendra', serif",
                        background: 'linear-gradient(180deg, #10b981, #059669)',
                        border: '1.5px solid #d4af37',
                        color: '#fef3c7',
                        boxShadow: '0 1px 6px rgba(5,150,105,0.3)',
                      }}
                    >
                      {loading ? "Joining..." : "Join Match"}
                    </button>
                  </div>
                ))
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
                Change Commander Name
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
                maxLength={20}
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
    </div>
  );
};
