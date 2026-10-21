import "dotenv/config";

/** Reads a required environment variable, failing loudly when it is missing. */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function jwtSecret(): string {
  const secret = required("JWT_SECRET");
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  return secret;
}

export function jwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || "7d";
}

export function bcryptSaltRounds(): number {
  const parsed = Number(process.env.BCRYPT_SALT_ROUNDS);
  if (!Number.isInteger(parsed) || parsed < 8 || parsed > 15) {
    return 12;
  }
  return parsed;
}

/** Google client id, or `null` when Google sign-in has not been configured. */
export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}
