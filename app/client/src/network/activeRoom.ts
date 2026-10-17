import type { Room } from '@colyseus/sdk';

/** sessionStorage key holding the last match this tab held a seat in. */
const STORAGE_KEY = 'active-match';

/** Snapshot of a match the tab can still rejoin after a reload. */
export interface ActiveMatch {
  roomId: string;
  reconnectionToken: string;
}

/**
 * Persists the match so a hard refresh can offer a reconnect, mirroring the
 * server's held-seat window.
 *
 * @param room - The joined room whose `roomId` + `reconnectionToken` to store.
 *
 * @remarks Best-effort: storage can be unavailable (private mode), so failures
 * are swallowed. Stored in `sessionStorage`, not `localStorage`: the token is
 * per-tab and must not be shared, otherwise a second tab (another player on the
 * same browser) overwrites it and reconnecting hijacks the other player's seat.
 * The token is opaque (`<roomId>:<token>`); the lobby hands it to
 * `client.reconnect`.
 */
export function saveActiveMatch(
  room: Pick<Room, 'roomId' | 'reconnectionToken'>,
): void {
  try {
    const snapshot: ActiveMatch = {
      roomId: room.roomId,
      reconnectionToken: room.reconnectionToken,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}

/** Reads the stored match, or `null` when absent/corrupt. */
export function loadActiveMatch(): ActiveMatch | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ActiveMatch>;
    if (
      typeof parsed.roomId !== 'string' ||
      typeof parsed.reconnectionToken !== 'string'
    ) {
      return null;
    }

    return {
      roomId: parsed.roomId,
      reconnectionToken: parsed.reconnectionToken,
    };
  } catch {
    return null;
  }
}

/**
 * Drops the stored match.
 *
 * @remarks Called on an intentional leave (so the lobby stops offering a
 * reconnect) and when a reconnect attempt is refused.
 */
export function clearActiveMatch(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
