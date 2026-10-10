import { Client } from '@colyseus/sdk';
import React, { useState } from 'react';
import { Lobby } from './componenets/Lobby';
import { GameContainer } from './componenets/GameContainer';

// Connect to your Colyseus server URL (env or localhost fallback)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";
const colyseusClient = new Client(SERVER_URL);

export default function App() {
  const [currentRoom, setCurrentRoom] = useState<any>(null);

  const handleJoinRoom = (room: any) => {
    setCurrentRoom(room);
  };

  const handleLeaveRoom = () => {
    if (currentRoom) {
      currentRoom.leave();
    }
    setCurrentRoom(null);
  };

  return (
    <div className="w-screen h-screen bg-slate-900 text-white overflow-hidden flex items-center justify-center">
      {!currentRoom ? (
        <Lobby client={colyseusClient} onJoinRoom={handleJoinRoom} />
      ) : (
        <GameContainer room={currentRoom} onLeaveRoom={handleLeaveRoom} />
      )}
    </div>
  );
}
