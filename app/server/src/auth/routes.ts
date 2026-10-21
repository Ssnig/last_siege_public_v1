import bcrypt from "bcryptjs";
import {
  Router,
  json,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  UserModel,
  toPublicUser,
  type UserDocument,
} from "../models/User.js";
import { bcryptSaltRounds, googleClientId } from "./config.js";
import { HttpError } from "./errors.js";
import { verifyGoogleCredential } from "./google.js";
import { requireAuth, type AuthenticatedRequest } from "./middleware.js";
import { signAuthToken } from "./tokens.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 40;

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/** Express 5 forwards rejected promises, but wrapping keeps typings simple. */
function route(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

function parseEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "A valid email address is required.");
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, "A valid email address is required.");
  }
  return email;
}

function parsePassword(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < MIN_PASSWORD_LENGTH ||
    value.length > MAX_PASSWORD_LENGTH
  ) {
    throw new HttpError(
      400,
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }
  return value;
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

function parseName(value: unknown, fallback?: string): string {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return cleanName(fallback);
    throw new HttpError(400, "A display name is required.");
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "A display name is required.");
  }
  const name = cleanName(value);
  if (!name) {
    throw new HttpError(400, "A display name is required.");
  }
  return name;
}

function parseAvatarUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Avatar URL must be a string.");
  }
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 2048) {
    throw new HttpError(400, "Avatar URL is too long.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(400, "Avatar URL must be a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "Avatar URL must use http or https.");
  }
  return url.toString();
}

function sessionPayload(user: UserDocument) {
  return {
    token: signAuthToken({ id: user._id.toString(), email: user.email }),
    user: toPublicUser(user),
  };
}

function currentUser(req: Request): UserDocument {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }
  return user;
}

export const authRouter = Router();

authRouter.use(json({ limit: "64kb" }));
authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/** Whether Google sign-in is available, and the public client id to use. */
authRouter.get("/google/config", (_req, res) => {
  res.json({ clientId: googleClientId() });
});

authRouter.post(
  "/register",
  route(async (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = parsePassword(req.body?.password);
    const name = parseName(req.body?.name, email.split("@")[0]);

    const existing = await UserModel.exists({ email });
    if (existing) {
      throw new HttpError(
        409,
        "An account with this email already exists.",
      );
    }

    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds());
    const user = await UserModel.create({ email, passwordHash, name });

    res.status(201).json(sessionPayload(user));
  }),
);

authRouter.post(
  "/login",
  route(async (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = parsePassword(req.body?.password);

    const user = await UserModel.findOne({ email }).select("+passwordHash");
    if (!user?.passwordHash) {
      throw new HttpError(401, "Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, "Invalid email or password.");
    }

    res.json(sessionPayload(user));
  }),
);

authRouter.post(
  "/google",
  route(async (req, res) => {
    const credential =
      typeof req.body?.credential === "string"
        ? req.body.credential.trim()
        : "";
    if (!credential) {
      throw new HttpError(400, "A Google credential is required.");
    }

    const profile = await verifyGoogleCredential(credential);

    let user = await UserModel.findOne({ googleId: profile.sub });
    if (!user) {
      const existing = await UserModel.findOne({ email: profile.email }).select(
        "+passwordHash",
      );

      if (existing) {
        // Never attach a Google identity to a password account automatically:
        // an unverified local registration must not become an account-takeover
        // path for the real owner of that email address.
        if (existing.passwordHash || (existing.googleId && existing.googleId !== profile.sub)) {
          throw new HttpError(
            409,
            "An account with this email already exists. Sign in with your password.",
          );
        }
        existing.googleId = profile.sub;
        if (!existing.avatarUrl && profile.picture) {
          existing.avatarUrl = profile.picture;
        }
        await existing.save();
        user = existing;
      } else {
        user = await UserModel.create({
          email: profile.email,
          name: parseName(profile.name, profile.email.split("@")[0]),
          avatarUrl: profile.picture,
          googleId: profile.sub,
        });
      }
    }

    res.json(sessionPayload(user));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  route(async (req, res) => {
    res.json({ user: toPublicUser(currentUser(req)) });
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
  route(async (req, res) => {
    const user = currentUser(req);
    let changed = false;

    if (req.body?.name !== undefined) {
      user.name = parseName(req.body.name);
      changed = true;
    }
    if (req.body?.avatarUrl !== undefined) {
      user.avatarUrl = parseAvatarUrl(req.body.avatarUrl);
      changed = true;
    }
    if (!changed) {
      throw new HttpError(400, "Nothing to update.");
    }

    await user.save();
    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    const err = error as { code?: number; type?: string };
    if (err?.code === 11000) {
      res
        .status(409)
        .json({ error: "An account with this email already exists." });
      return;
    }
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON body." });
      return;
    }
    if (err?.type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large." });
      return;
    }

    console.error("Auth API error:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  },
);
