import  { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Room } from '@colyseus/sdk';
import { Lobby } from './componenets/Lobby';
import { GameRoute } from './componenets/GameRoute';
import { GameRoomContext, type GameRoomContextValue } from './network/roomContext';
import { client } from './network/client';
import { clearActiveMatch, saveActiveMatch } from './network/activeRoom';

import { LandingPage } from './componenets/landing/LandingPage';
import { OrientationPrompt } from './componenets/mobile/OrientationPrompt';
import { MobileFullscreenGate } from './componenets/mobile/MobileFullscreenGate';
import { InitialLoadingScreen } from './componenets/common/InitialLoadingScreen';
import { MapEditor } from './componenets/editor/MapEditor';

/**
 * Root shell: route-based. `/` hosts the game welcome/landing page,
 * `/lobby` hosts matchmaking, and `/game/:roomId` an active match.
 *
 * @remarks
 * `GameRoomContext` owns the one shared Colyseus room for the whole app
 * (module singleton `client`) — don't spin up another connection.
 */
export default function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const roomContext: GameRoomContextValue = { room, setRoom };

  // Track the previously held room so a transition *back* to null (an
  // intentional leave) clears the stored reconnect, while the initial null on a
  // hard refresh leaves it intact for the lobby's resume prompt.
  const previousRoomRef = useRef<Room | null>(null);
  useEffect(() => {
    if (room) {
      saveActiveMatch(room);
    } else if (previousRoomRef.current) {
      clearActiveMatch();
    }
    previousRoomRef.current = room;
  }, [room]);

  return (
    <div className="w-screen h-screen bg-slate-900 text-white overflow-hidden flex items-center justify-center">
      <InitialLoadingScreen />
      <MobileFullscreenGate />
      <OrientationPrompt />
      <GameRoomContext.Provider value={roomContext}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/lobby" element={<Lobby client={client} />} />
          <Route path="/game/:roomId" element={<GameRoute />} />
          <Route path="/editor" element={<MapEditor />} />
          <Route path="*" element={<Navigate to="/lobby" replace />} />
        </Routes>
      </GameRoomContext.Provider>
    </div>
  );
}

