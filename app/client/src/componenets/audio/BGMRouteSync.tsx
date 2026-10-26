import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { bgmManager } from '../../audio/bgmManager';

/**
 * Route-aware soundtrack controller.
 * Handles automatic music track switching and smooth fade-in / fade-out
 * transitions across application pages, with an exemption for the Map Editor.
 */
export const BGMRouteSync: React.FC = () => {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = location.pathname;
    const prevPath = prevPathRef.current;
    prevPathRef.current = currentPath;

    // 1. Map Editor & Sound Editor exemption: fade out and stop music completely
    if (currentPath === '/editor' || currentPath === '/sounds' || currentPath === '/dev/sounds') {
      bgmManager.stop(350).catch(() => {});
      return;
    }

    // 2. In-game battle: let GameContainer manage phase-specific soundtrack (DraftPhase vs InGameMusic)
    if (currentPath.startsWith('/game/')) {
      return;
    }

    // 3. Menus (Landing, Lobby, etc.): play Lobby game theme
    if (prevPath === null) {
      // Initial page mount
      bgmManager.playTrack('lobby', 800).catch(() => {});
    } else if (prevPath === '/editor' || prevPath === '/sounds' || prevPath === '/dev/sounds' || prevPath.startsWith('/game/')) {
      // Returning from editor or game match back to menu/lobby
      bgmManager.playTrack('lobby', 700).catch(() => {});
    } else if (prevPath !== currentPath) {
      // Page-to-page navigation within menus (e.g., Landing -> Lobby):
      // Smoothly dip volume down and back up on the new page
      bgmManager.fadeTransition(undefined, 500).catch(() => {});
    }
  }, [location.pathname]);

  return null;
};

