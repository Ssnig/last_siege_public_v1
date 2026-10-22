import { RANKING_CONFIG, getRankForElo, type RankTier } from '@root/shared';

const GUEST_ID_KEY = 'guest-id';
const GUEST_ELO_KEY = 'guest-elo';
const GUEST_NAME_KEY = 'player-name';

export interface GuestProfile {
  guestId: string;
  name: string;
  elo: number;
  rank: RankTier;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
}

/**
 * Returns the persistent unique guest ID for this browser, creating one if not yet set.
 */
export function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id || !id.trim()) {
      const rand = Math.random().toString(36).substring(2, 10);
      const stamp = Date.now().toString(36);
      id = `guest_${rand}_${stamp}`;
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return 'guest_temporary';
  }
}

/**
 * Retrieves the guest's cached Elo rating from localStorage.
 */
export function getGuestElo(): number {
  try {
    const raw = localStorage.getItem(GUEST_ELO_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {}
  return RANKING_CONFIG.defaultElo;
}

/**
 * Persists an updated guest Elo rating to localStorage.
 */
export function setGuestElo(elo: number): void {
  try {
    localStorage.setItem(GUEST_ELO_KEY, String(Math.round(elo)));
  } catch {}
}

/**
 * Gets the current guest profile composed from local storage.
 */
export function getLocalGuestProfile(): GuestProfile {
  const guestId = getOrCreateGuestId();
  const elo = getGuestElo();
  let name = 'Guest';
  try {
    name = localStorage.getItem(GUEST_NAME_KEY) || 'Guest';
  } catch {}

  return {
    guestId,
    name,
    elo,
    rank: getRankForElo(elo),
  };
}

/**
 * Synchronizes the guest user with the backend database.
 */
export async function syncGuestWithServer(customName?: string): Promise<GuestProfile> {
  const guestId = getOrCreateGuestId();
  const currentElo = getGuestElo();
  let name = customName;
  if (!name) {
    try {
      name = localStorage.getItem(GUEST_NAME_KEY) || 'Guest';
    } catch {
      name = 'Guest';
    }
  }

  try {
    const response = await fetch('/api/auth/guest/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        name,
        elo: currentElo,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.guest) {
        const serverElo = data.guest.elo ?? currentElo;
        setGuestElo(serverElo);
        return {
          guestId: data.guest.guestId,
          name: data.guest.name,
          elo: serverElo,
          rank: getRankForElo(serverElo),
          matchesPlayed: data.guest.matchesPlayed,
          wins: data.guest.wins,
          losses: data.guest.losses,
        };
      }
    }
  } catch (err) {
    console.warn('Could not sync guest user with backend:', err);
  }

  return getLocalGuestProfile();
}
