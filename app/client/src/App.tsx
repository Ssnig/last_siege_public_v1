import  { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Room } from '@colyseus/sdk';
import { Lobby } from './componenets/Lobby';
import { GameRoute } from './componenets/GameRoute';
import { GameRoomContext, type GameRoomContextValue } from './network/roomContext';
import { client } from './network/client';

/**
 * Root shell: route-based. `/lobby` hosts matchmaking and `/game/:roomId` an
 * active match. `/` will become a landing page later; for now it redirects.
 *
 * @remarks
 * `GameRoomContext` owns the one shared Colyseus room for the whole app
 * (module singleton `client`) — don't spin up another connection.
 */
export default function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const roomContext: GameRoomContextValue = { room, setRoom };

  return (
    <div className="w-screen h-screen bg-slate-900 text-white overflow-hidden flex items-center justify-center">
      <GameRoomContext.Provider value={roomContext}>
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={<Lobby client={client} />} />
          <Route path="/game/:roomId" element={<GameRoute />} />
          <Route path="*" element={<Navigate to="/lobby" replace />} />
        </Routes>
      </GameRoomContext.Provider>
    </div>
  );
}