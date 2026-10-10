import { schema, t } from "@colyseus/schema";

export const Player = schema({
  name: t.string(),
  role : t.string(),
})
