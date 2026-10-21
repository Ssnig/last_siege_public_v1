import type { AuthResponse, AuthUser } from './types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ErrorBody = { error?: unknown };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Unable to reach the game server. Check your connection.', 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const body = data as ErrorBody | null;
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export const authApi = {
  register(input: { email: string; password: string; name?: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  signInWithGoogle(credential: string): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  },

  me(token: string): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/api/auth/me', {
      headers: bearer(token),
    });
  },

  updateProfile(
    token: string,
    input: { name?: string; avatarUrl?: string },
  ): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/api/auth/me', {
      method: 'PATCH',
      headers: bearer(token),
      body: JSON.stringify(input),
    });
  },

  googleConfig(): Promise<{ clientId: string | null }> {
    return request<{ clientId: string | null }>('/api/auth/google/config');
  },
};
