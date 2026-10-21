export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
