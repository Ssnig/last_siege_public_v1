import { Navigate, useNavigate } from 'react-router-dom';
import { GameContainer } from './GameContainer';
import { clearActiveMatch } from '../network/activeRoom';
import { useGameRoom } from '../network/roomContext';

/**
 * Gate for `/game/:roomId`.
 *
 * Renders the in-context room when one exists — the normal flow from the lobby
 * sets it (create, join, or resumed reconnect) before navigating here. A hard
 * refresh or a direct link arrives with no live room, so it falls back to the
 * lobby instead of silently `joinById`-ing: the resume prompt there can
 * re-establish a running match, whereas a blind join could seat the tab as a
 * fresh player or fail against a locked room.
 */
export const GameRoute = () => {
  const { room } = useGameRoom();
  const navigate = useNavigate();

  /**
   * Leaves the match on purpose: the stored reconnect is dropped first so the
   * lobby does not offer to resume a game the player chose to quit.
   */
  const handleLeaveRoom = () => {
    clearActiveMatch();
    navigate('/lobby');
  };

  if (!room) {
    return <Navigate to="/lobby" replace />;
  }

  return <GameContainer room={room} onLeaveRoom={handleLeaveRoom} />;
};
