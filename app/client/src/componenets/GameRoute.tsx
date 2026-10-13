import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Room } from '@colyseus/sdk';
import { GameContainer } from './GameContainer';
import { client } from '../network/client';
import { useGameRoom } from '../network/roomContext';

/**
 * Gate for `/game/:roomId`.
 *
 * Renders the already-joined room when present (normal flow from the lobby).
 * On a hard refresh or direct link there is no live room, so it attempts a
 * best-effort `joinById`. Rejoining an in-progress/full match can legitimately
 * fail today (no server-side reconnection yet) — the error screen suggests the
 * lobby.
 */
export const GameRoute = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, setRoom } = useGameRoom();
  const navigate = useNavigate();
  const [joinFailed, setJoinFailed] = useState<string | null>(null);

  useEffect(() => {
    if (room || !roomId || joinFailed) return;

    let cancelled = false;
    client
      .joinById(roomId, {
        playerName: localStorage.getItem('player-name') ?? 'Player',
      })
      .then((joined: Room) => {
        if (!cancelled) setRoom(joined);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setJoinFailed(e instanceof Error ? e.message : 'Could not join that match.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [room, roomId, joinFailed, setRoom]);

  if (room) {
    return <GameContainer room={room} onLeaveRoom={() => navigate('/lobby')} />;
  }

  if (joinFailed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <h2 className="text-xl font-bold text-white">Cannot join this match</h2>
        <p className="text-sm text-slate-400">{joinFailed}</p>
        <button
          onClick={() => navigate('/lobby')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold text-white transition"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
      <p className="text-sm text-slate-400">Joining match...</p>
    </div>
  );
};