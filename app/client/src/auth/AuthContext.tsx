import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, authApi } from './api';
import type { AuthUser } from './types';

const TOKEN_STORAGE_KEY = 'auth-token';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (input: { name?: string; avatarUrl?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!readStoredToken());

  const applySession = useCallback((nextToken: string, nextUser: AuthUser) => {
    storeToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    authApi
      .me(token)
      .then(({ user: nextUser }) => {
        if (cancelled) return;
        setUser(nextUser);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Only discard the stored token when the server says it is invalid.
        // Network/server outages should not erase a valid session.
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          storeToken(null);
          setToken(null);
          setUser(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login({ email, password });
      applySession(session.token, session.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const trimmedName = name.trim();
      const session = await authApi.register({
        email,
        password,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
      applySession(session.token, session.user);
    },
    [applySession],
  );

  const signInWithGoogle = useCallback(
    async (credential: string) => {
      const session = await authApi.signInWithGoogle(credential);
      applySession(session.token, session.user);
    },
    [applySession],
  );

  const signOut = useCallback(() => {
    storeToken(null);
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const updateProfile = useCallback(
    async (input: { name?: string; avatarUrl?: string }) => {
      if (!token) {
        throw new Error('You must be signed in to update your profile.');
      }
      const { user: nextUser } = await authApi.updateProfile(token, input);
      setUser(nextUser);
    },
    [token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      signIn,
      register,
      signInWithGoogle,
      signOut,
      updateProfile,
    }),
    [user, token, loading, signIn, register, signInWithGoogle, signOut, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
