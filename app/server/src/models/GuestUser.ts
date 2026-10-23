import mongoose, {
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { RANKING_CONFIG, getRankForElo } from "@root/shared";

const guestUserSchema = new Schema(
  {
    guestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: { type: String, default: "Guest", trim: true, maxlength: 40 },
    elo: { type: Number, default: RANKING_CONFIG.defaultElo, index: true },
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type GuestUserRecord = InferSchemaType<typeof guestUserSchema>;
export type GuestUserDocument = HydratedDocument<GuestUserRecord>;

export const GuestUserModel =
  (mongoose.models.GuestUser as Model<GuestUserRecord> | undefined) ??
  mongoose.model<GuestUserRecord>("GuestUser", guestUserSchema);

export interface PublicGuestUser {
  guestId: string;
  name: string;
  elo: number;
  rankId: string;
  rankName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

/** Prepares a public projection of a guest user with rank details. */
export function toPublicGuestUser(guest: GuestUserDocument): PublicGuestUser {
  const elo = guest.elo ?? RANKING_CONFIG.defaultElo;
  const rank = getRankForElo(elo);
  return {
    guestId: guest.guestId,
    name: guest.name,
    elo,
    rankId: rank.id,
    rankName: rank.name,
    matchesPlayed: guest.matchesPlayed ?? 0,
    wins: guest.wins ?? 0,
    losses: guest.losses ?? 0,
  };
}
