import  { useState } from 'react';
import { Lobby } from './componenets/Lobby';
import { GameContainer } from './componenets/GameContainer';
import { client } from './network/client';

/**
 * Root shell. Shows the `Lobby` until a room is joined, then swaps to the game.
 *
 * @remarks
 * Owns the one shared Colyseus `Client` for the whole app (module singleton) —
 * don't spin up another, or you'll open duplicate connections.
 */
export default function App() {
  const [currentRoom, setCurrentRoom] = useState<any>(null);

  const handleJoinRoom = (room: any) => {
    setCurrentRoom(room);
  };

  const handleLeaveRoom = () => {
    if (currentRoom) {
      setCurrentRoom(null)
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-900 text-white overflow-hidden flex items-center justify-center">
      {!currentRoom ? (
        <Lobby client={client} onJoinRoom={handleJoinRoom} />
      ) : (
        <GameContainer room={currentRoom} onLeaveRoom={handleLeaveRoom} />
      )}
    </div>
  );
}
