/**
 * Safe browser storage wrapper.
 * Provides fallback in-memory storage if localStorage/sessionStorage is blocked
 * by browser privacy rules, sandboxed iframes, or incognito mode.
 */

const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Access denied or private browsing
    }
    return memoryStorage.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Access denied or quota exceeded
    }
    memoryStorage.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Access denied
    }
    memoryStorage.delete(key);
  },
};
