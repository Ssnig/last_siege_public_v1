# 1v1 Real-Time Multiplayer Tower Defense

An asymmetric 1v1 multiplayer strategy tower defense game built with **React**, **Phaser**, and **Colyseus** in a modern monorepo architecture.

## 🚀 Features
- **Real-Time Matchmaking Lobby:** Live room discovery and dynamic synchronization using Colyseus lobby rooms.
- **Asymmetric 1v1 Role System:** Flexible room creation rules supporting Attacker, Defender, Any (first-come), and Randomized role allocation.
- **Monorepo Structure:** Clean separation of client, server, and shared logic packages.

---

## 🛠️ Tech Stack
- **Frontend:** React, Tailwind CSS, Phaser 3, Colyseus Client SDK
- **Backend:** Node.js, Colyseus Matchmaker / Room Framework
- **Monorepo Management:** npm Workspaces / TypeScript

---

## 📦 Project Structure
```text
├── app/
│   ├── client/         # React frontend + Phaser game canvas & HUD
│   └── server/         # Colyseus game server & room lifecycle logic
├── packages/
│   └── shared/         # Shared TypeScript types, interfaces, and schemas
```

---

## Installation

Clone the repo, then install all workspace dependencies from the root:

```bash
npm install
```

Before you can run anything (server, client, or tests), build the shared package once. It's imported from its compiled `dist/` folder, and that folder is gitignored — so a fresh clone has none:

```bash
npm run build:shared
```
Configure environment variables, currently, only client side is needed:
```bash
# app/client/.env
VITE_SERVER_URL=ws://localhost:2567
```

Then start the server and client in separate terminals:

```bash
npm run dev:server   # Colyseus server on ws://localhost:2567
npm run dev:client   # Vite dev server
```

For production builds, `npm run build:server` and `npm run build:client` compile the shared package automatically in the process — no manual `build:shared` needed there.

---

## Shared package

`@root/shared` holds the types, schemas, balance values and message keys both apps share. Both the server and client import it from its built `dist/` output, **not** straight from source. So:

- **First clone or a fresh environment?** Run `npm run build:shared` once (or any of the `build:*` scripts above).
- **Editing something in `packages/shared/src/`?** Rebuild it. Either keep `npm run dev:shared` running in the background (it watches and recompiles on save), or just run `npm run build:shared` after every change. Server tests (`npm test`) read from `dist/` too, so make sure it's up to date before running those.

One gotcha: `tsc` never cleans up old output, so if you rename or delete a shared file, its ghost stays in `dist/`. `rm -rf packages/shared/dist` before rebuilding keeps things tidy.
