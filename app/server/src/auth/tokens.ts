import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { jwtExpiresIn, jwtSecret } from "./config.js";

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
}

export function signAuthToken(user: { id: string; email: string }): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: jwtExpiresIn() as SignOptions["expiresIn"],
  };
  return jwt.sign({ email: user.email }, jwtSecret(), options);
}

/** Verifies a bearer token and returns its payload, throwing on any problem. */
export function verifyAuthToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, jwtSecret());
  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new Error("Invalid token payload");
  }
  return payload as AuthTokenPayload;
}
