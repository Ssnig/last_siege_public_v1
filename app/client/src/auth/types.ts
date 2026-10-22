export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  elo: number;
  rankId: string;
  rankName: string;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
