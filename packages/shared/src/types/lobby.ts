/** Host's role preference. `"random"` coin-flips the host's role. */
export type RoleChoice = "attacker" | "defender" | "random";
export type AssignedRole = "attacker" | "defender";

/**
 * Lifecycle status of a match room in the lobby browser.
 *
 * @remarks
 * `"available"` means the room is still waiting for an opponent; `"playing"`
 * means a match has begun. Once playing, a room stays playing for its whole
 * life — even if a player leaves — so it is never re-advertised as joinable.
 */
export type RoomStatus = "available" | "playing";

/** Public room info shown in the lobby browser. */
export interface RoomMetadata {
  creatorName: string;
  roleChoice: RoleChoice;
  status?: RoomStatus;
  assignedRoles?: {
    creator?: AssignedRole;
    joiner? : AssignedRole
  }
}
