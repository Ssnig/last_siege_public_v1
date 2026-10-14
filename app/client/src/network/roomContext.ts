import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { Room } from '@colyseus/sdk';

export interface GameRoomContextValue {
  room: Room | null;
  setRoom: Dispatch<SetStateAction<Room | null>>;
}

export const GameRoomContext = createContext<GameRoomContextValue>({
  room: null,
  setRoom: () => {},
});

/**
 * Shared access to the single active Colyseus room. The joined `Room` must
 * live outside Lobby/GameContainer state so it survives route transitions.
 */
export const useGameRoom = () => useContext(GameRoomContext);