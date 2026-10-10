export type RoleChoice = "attacker" | "defender" | "any" | "random";
export type AssignedRole = "attacker" | "defender";

export interface RoomMetadata {
  creatorName: string;
  roleChoice: RoleChoice;
  assignedRoles?: {
    creator?: AssignedRole;
    joiner? : AssignedRole
  }
}
