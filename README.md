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
├── apps/
│   ├── client/         # React frontend + Phaser game canvas & HUD
│   └── server/         # Colyseus game server & room lifecycle logic
├── packages/
│   └── shared/         # Shared TypeScript types, interfaces, and schemas

---

## Installation
Clone the repository and install all workspace dependencies from the root directory:
```bash
npm install
```

Go to the server folder, install dependencies and start server
```bash
cd app/server
npm install
npm start
```

Open a separate terminal, go to client folder and install dependencies and then start the client vite server
```bash
cd app/client
npm install
npm run dev
```
