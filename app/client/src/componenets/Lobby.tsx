import React, { useState, useEffect } from 'react';
import type { RoleChoice } from '@root/shared';
import type { Client, Room, RoomAvailable } from '@colyseus/sdk';

interface LobbyProps {
  client: Client;
  onJoinRoom: (room: any) => void;
}

/**
 * Match lobby: nickname gate, live room browser, and room creation.
 *
 * @remarks
 * The nickname is persisted in `localStorage` under `player-name`, so the name
 * prompt is skipped on return visits (the initial state is seeded lazily from
 * storage — no extra effect). Once past the gate it joins a `lobby` LobbyRoom:
 * `"rooms"` is the initial snapshot and `+` / `-` are realtime add/remove diffs.
 * The lobby connection is torn down on unmount.
 */
export const Lobby: React.FC<LobbyProps> = ({ client, onJoinRoom }) => {
  const [name, setName] = useState<string>(() => localStorage.getItem('player-name') ?? '');
  const [isNamed, setIsNamed] = useState<boolean>(() => !!localStorage.getItem('player-name'));
  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [selectedRoleChoice, setSelectedRoleChoice] = useState<RoleChoice>("random");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Trims, persists the nickname, and moves past the name gate. No-op if blank. */
  const confirmName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('player-name', trimmed);
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
      } catch (e) {
        console.error("Failed to join lobby room:", e);
      }
    })();

    return () => {
      if (lobbyRoom) {
        lobbyRoom.leave();
      }
    };
  }, [isNamed]);

  /** Creates a `game_room` with the chosen role preference and hands it to the parent. */
  const handleCreateRoom = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const room = await client.create("game_room", {
        playerName: name,
        roleChoice: selectedRoleChoice,
      });
      onJoinRoom(room);
    } catch (e: any) {
      console.error("Error creating room:", e);
      setErrorMessage(e.message || "Failed to create room.");
      setLoading(false);
    }
  };

  /** Joins an existing room by id; surfaces an error if it's full or already closed. */
  const handleJoinRoom = async (roomId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const room = await client.joinById(roomId, {
        playerName: name,
      });
      onJoinRoom(room);
    } catch (e: any) {
      console.error("Error joining room:", e);
      setErrorMessage(e.message || "Failed to join room. It may be full or closed.");
      setLoading(false);
    }
  };

  // Step 1: Name Entry Screen
  if (!isNamed) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-5 w-full max-w-md">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome Player</h1>
            <p className="text-sm text-slate-400">Enter a nickname to access the match lobby</p>
          </div>
          <input
            type="text"
            placeholder="Your Nickname..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmName()}
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            disabled={!name.trim()}
            onClick={confirmName}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
          >
            Continue to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Main Lobby Browser & Creation Screen
  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-6 gap-6 justify-center">
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h2 className="text-xl font-bold text-white">Match Lobby</h2>
            <p className="text-xs text-slate-400">Commander: <span className="text-indigo-400 font-medium">{name}</span></p>
          </div>
        </div>
        <button
          onClick={() => setIsNamed(false)}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          Change Name
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[460px]">
        {/* Create Room Panel */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-lg">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white border-b border-slate-800 pb-3">Create Matchroom</h3>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Role Preference</label>
              <select
                value={selectedRoleChoice}
                onChange={(e) => setSelectedRoleChoice(e.target.value as RoleChoice)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="attacker">Attacker</option>
                <option value="defender">Defender</option>
                <option value="random">Randomized</option>
              </select>
            </div>
          </div>
          <button
            disabled={loading}
            onClick={handleCreateRoom}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm text-white transition disabled:opacity-50 shadow-lg shadow-emerald-600/20"
          >
            {loading ? "Creating..." : "Host New Match"}
          </button>
        </div>

        {/* Room List Panel */}
        <div className="md:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col gap-4 shadow-lg overflow-hidden">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-white">Active Lobbies ({rooms.length})</h3>
          </div>

          <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm italic gap-1">
                <p>No open matches found.</p>
                <p className="text-xs">Host a room to start playing!</p>
              </div>
            ) : (
              rooms.map((room) => (
                <div key={room.roomId} className="flex justify-between items-center bg-slate-950/60 px-4 py-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm text-white">{room.metadata?.creatorName}'s Arena</p>
                    <p className="text-xs text-slate-400">
                      Preference: <span className="text-indigo-400 uppercase font-medium">{room.metadata?.roleChoice}</span>
                    </p>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => handleJoinRoom(room.roomId)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs rounded-lg font-semibold text-white transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
                  >
                    {loading ? "Joining..." : "Join Match"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
