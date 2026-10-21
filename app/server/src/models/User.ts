import mongoose, {
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    /** Absent for accounts created through an OAuth provider. */
    passwordHash: { type: String, select: false },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    avatarUrl: { type: String, default: "", maxlength: 2048 },
    googleId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserRecord>;

export const UserModel =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema);

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/** Strips credentials and Mongo internals before sending a user to a client. */
export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
  };
}
