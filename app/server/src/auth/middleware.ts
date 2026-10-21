import type { NextFunction, Request, Response } from "express";
import { UserModel, type UserDocument } from "../models/User.js";
import { verifyAuthToken } from "./tokens.js";

export interface AuthenticatedRequest extends Request {
  user?: UserDocument;
}

/** Rejects requests without a valid bearer token and attaches the user. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  let userId: string;
  try {
    userId = verifyAuthToken(token).sub;
  } catch {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(401).json({ error: "Invalid or expired session." });
      return;
    }
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
}
