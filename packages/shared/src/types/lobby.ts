/** Host's role preference. `"any"` = first-come, `"random"` = coin-flip. */
export type RoleChoice = "attacker" | "defender" | "any" | "random";
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
