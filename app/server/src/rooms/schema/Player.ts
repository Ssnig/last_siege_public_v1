import { schema, t } from "@colyseus/schema";

/** Per-player networked state. Mutations auto-sync to all clients. */
export const Player = schema({
  name: t.string(),
  role : t.string(),
})
