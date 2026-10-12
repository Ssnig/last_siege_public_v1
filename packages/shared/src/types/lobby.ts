/** Host's role preference. `"random"` coin-flips the host's role. */
export type RoleChoice = "attacker" | "defender" | "random";
export type AssignedRole = "attacker" | "defender";

/** Public room info shown in the lobby browser. */
export interface RoomMetadata {
  creatorName: string;
  roleChoice: RoleChoice;
  assignedRoles?: {
    creator?: AssignedRole;
    joiner? : AssignedRole
  }
}
