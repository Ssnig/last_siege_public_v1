# 🏯 1v1 Real-Time Multiplayer Tower Defense: Ancient Burma

[![Colyseus 0.18](https://img.shields.io/badge/Colyseus-0.18-blue.svg)](https://colyseus.io/)
[![React 19](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3%2F4-ff69b4.svg)](https://phaser.io/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.3-38bdf8.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%2F6.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests Passing](https://img.shields.io/badge/Tests-121%20passing-brightgreen.svg)]()

An asymmetric, competitive 1v1 real-time multiplayer tower defense game set in the rich historical eras and landscapes of ancient Burma (Bagan, Konbaung, Inle, Mandalay, and beyond). Built from the ground up with **React 19**, **Phaser 3**, and **Colyseus 0.18** within a modular TypeScript monorepo.

---

## 📖 Table of Contents
- [🌟 Key Features](#-key-features)
- [⚔️ Asymmetric Gameplay & Match Lifecycle](#️-asymmetric-gameplay--match-lifecycle)
- [🗺️ The 9 Canonical Battlefields](#️-the-9-canonical-battlefields)
- [🎨 2.5D Isometric Scenery Props & NPCs](#-25d-isometric-scenery-props--npcs)
- [🛠️ In-Browser Map & Path Editor](#️-in-browser-map--path-editor)
- [🏆 Competitive Ranking & Elo System](#-competitive-ranking--elo-system)
- [🏗️ Tech Stack & Monorepo Architecture](#️-tech-stack--monorepo-architecture)
- [🚀 Getting Started](#-getting-started)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
- [⚖️ Balance & Modding Guide](#️-balance--modding-guide)

---

## 🌟 Key Features

- **Asymmetric 1v1 Competition:** One player commands the siege waves as the **Attacker**, while the other constructs and upgrades strategic fortifications as the **Defender**.
- **Three-Stage Match Flow:** Synchronized match stages spanning a round-based **Draft Stage**, tactical **Building & Buffer Stage**, and action-packed real-time **Combat Stage**.
- **Dual Damage Channels:** Deep combat mathematics featuring **Physical Damage** (mitigated by armor) and **Mental Damage** (penetrates armor, shatters resolve, cracks units for amplified subsequent damage, and inflicts slows).
- **9 Canonical Battlefields:** Hand-crafted, multi-lane historical maps featuring branching paths, forks, merges, and diverse environmental themes.
- **Atmospheric 2.5D Scenery Props:** Hand-drawn 2.5D isometric scenery assets (banyans, pagodas, torana arches, boulders, caves, bullock carts, village shrines) and ambient animated NPCs (monks, villagers, hermits) with dynamic isometric Y-depth sorting.
- **Full In-Browser Level Editor (`/dev/editor`):** Visual pathing and waypoint tool, portal charge configuration, tower slot alignment, scenery prop staging, and direct file persistence.
- **Competitive Elo Rating & Tier Ranks:** Dynamic Elo rating adjustments, seasonal rank tiers (Bronze, Silver, Gold), and guest session persistence.
- **Robust Authoritative Netcode:** Colyseus room state machine with client reconciliation, reconnection seat-holding windows, and surrender handling.

---

## ⚔️ Asymmetric Gameplay & Match Lifecycle

Matches transition smoothly through three core phases orchestrated by the authoritative `GameRoom` server state machine:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   DRAFT STAGE   │ ────> │ BUILDING STAGE  │ ────> │  COMBAT STAGE   │
│ 2-2-2 Round Pick│       │ Towers & Queues │       │ Real-Time Siege │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 1. Phase 1: Draft Stage (Round-Based 2-2-2 Pick)
- Players construct their active match decks through a 3-round alternating draft.
- In each round, both players pick 2 cards simultaneously from random offers.
- **Attacker** selects siege units with varying armor, resolve, movement speed, and leak damage.
- **Defender** selects defensive towers with specialized ranges, damage channels, fire rates, and upgrade paths.
- Includes turn timers, deck synergy tooltips, and ready confirmations.

### 2. Phase 2: Building & Deploy Buffering Stage
- **Defender Actions:**
  - Build towers on designated strategic slot pads using starting gold.
  - Upgrade constructed towers through multiple tiers to increase range, fire rate, and damage.
  - Sell towers with partial gold refunds to adapt to the attacker's drafted composition.
- **Attacker Actions:**
  - Plan unit waves by queuing units into **Portal Deploy Buffers**.
  - Assign specific route portals for multi-track battlefields.
  - Earn passive siege preparation gold over time.

### 3. Phase 3: Real-Time Combat Stage
- **Siege Deployment:** Units are dispatched from portals into the battlefield according to speed-scaled stagger bands and portal charges.
- **Dual Damage Channels:**
  - **Physical Channel:** Blunted by mob armor rating:
    $$\text{Damage Taken} = \max\left(1, \text{Raw Damage} - \text{Armor}\right)$$
  - **Mental Channel:** Ignores armor completely, targeting mob resolve. Landing a mental strike cracks the target, applying slow effects and amplifying all subsequent mental damage:
    $$\text{Bonus Mental Damage} = \text{Raw Damage} \times \text{Crack Multiplier}$$
- **Pathing Simulation:** Units navigate spline waypoints with organic lateral corridor wander, avoiding unnatural single-file lines. Multi-lane tracks support forks (diverging routes) and merges (converging routes).
- **Deep-Unit Passive Income:** Attackers gain extra gold bonuses for units penetrating deep past 50% track progress.
- **Win Conditions:**
  - **Attacker Wins:** If leaking mobs reduce the Defender's base Core HP to 0.
  - **Defender Wins:** If the base Core survives until the Siege Timer expires.
  - **Surrender:** Either player may concede at any point.

---

## 🗺️ The 9 Canonical Battlefields

Every battlefield is historically themed after significant regions and eras of ancient Burma, fully authored with unique waypoint tracks, spawn portals, and tower pads:

| # | Map Name | ID | Theme & Terrain | Portals | Lanes / Tracks |
|---|---|---|---|---|---|
| **1** | **Konbaung Plains** | `konbaung` | Lush central plains, traditional stilt villages, banyan groves, and stream bridge | 1 | Single-lane starter route |
| **2** | **Bagan Terracotta** | `bagan` | Ancient red-brick plains, towering stupas, crumbling ruin walls, and dry savanna | 1 | Single serpentine lane |
| **3** | **Inle Lake** | `inle` | Aquatic palace pool, stone balustrades, arched bridges, and floating waterways | 1 | Serpentine stone concourse |
| **4** | **Mandalay Palace** | `mandalay` | Royal palace battlements, golden pyatthat spires, moat, and geometric royal gardens | 1 | Symmetrical palace courtyard |
| **5** | **Innwa Fort** | `innwa` | Historic walled citadel, fortified redoubts, and stone watchgrounds | 1 | Fortified perimeter loop |
| **6** | **Bago Jungle Karst** | `bago` | Dense tropical rainforest, overgrown brick ruins, and limestone karst cave mouths | 2 | Split converging jungle tracks |
| **7** | **Deserted Sands** | `deserted` | Arid sandstone canyons, sun-bleached earth, and suspension footbridges | 1 | Single canyon bypass |
| **8** | **Twister Canyon** | `twister` | Deep eroded gulch with dual canyon tracks and cratered stream crossings | 2 | Dual tracks (`upper` & `lower`) |
| **9** | **River Delta** | `river` | River delta archipelago with winding marsh islands and wooden footbridges | 2 | Dual tracks (`north` & `south`) |

---

## 🎨 2.5D Isometric Scenery Props & NPCs

To bring the battlefields to life, the game features a catalog of hand-drawn 2.5D isometric scenery assets styled after the *Kingdom Rush* / *Ironhide Game Studio* cartoon-comic fantasy aesthetic:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   2.5D ISOMETRIC VISUAL ASSETS CATALOG                  │
├─────────────┬──────────────────────────────────────────────────────────┤
│ Trees       │ • Ancient Banyan (dense cloud canopy & aerial roots)     │
│ & Flora     │ • Toddy Palm Cluster (curved trunks & tropical fronds)   │
│             │ • Golden Champak (flowering golden temple canopy)        │
│             │ • Weathered Dead Tree (bare branches, arid Bagan plains) │
├─────────────┼──────────────────────────────────────────────────────────┤
│ Rocks       │ • Mossy Granite Boulder (faceted ink linework)           │
│ & Caves     │ • Sandstone Cliff Outcrop (layered sedimentary strata)   │
│             │ • River Stone Cluster (smooth water-worn pebbles)        │
│             │ • Sacred Cavern Entrance (karst cliff & hanging ivy)     │
│             │ • Sunlit Grotto Alcove (warm amber sunset lighting)      │
├─────────────┼──────────────────────────────────────────────────────────┤
│ Ruins       │ • Ancient Bagan Pagoda (terracotta brick stupa & spire)  │
│ & Structures│ • Crumbling Torana Archway (carved stone & jungle vines) │
│             │ • Sanctuary Lotus Column & Dais (cracked octagonal dais) │
│             │ • Ancient Ruin Wall (weathered red-brick with moss)      │
│             │ • Burmese Bullock Cart (traditional wooden spoked wheels)│
│             │ • Village Nat Shrine (teak wood spirit house on stilts)  │
├─────────────┼──────────────────────────────────────────────────────────┤
│ Ambient     │ • Meditating Monk (saffron robes, prayer beads & staff)  │
│ Characters  │ • Kingdom Villager (checked longyi & conical sun hat)    │
│             │ • Forest Hermit (Yat-the, topknot bun, tiger-print sash) │
└─────────────┴──────────────────────────────────────────────────────────┘
```

### Depth Sorting & Ambient Living World
- **Dynamic Y-Depth Sorting:** Scenery props render into the Phaser actor display list using `actorDepth(prop.y)`, ensuring moving units, projectiles, and towers naturally overlap props depending on their ground contact position.
- **Ambient NPC Animations:** Ambient villagers and monks feature gentle breathing and bobbing tweens to add life to the maps without disrupting combat clarity.

---

## 🛠️ In-Browser Map & Path Editor

The game includes a level and path editing suite accessible directly in the browser at `/dev/editor` (or via the editor button in the match lobby):

```text
Editor URL: http://localhost:5173/dev/editor
```

### Editor Capabilities
- **Waypoint Path Authoring:** Click to add waypoints, drag to reposition, delete intermediate points, or configure multi-lane branches.
- **Spawn Portals:** Position custom spawn portals and configure per-portal charge rules.
- **Tower Slot Pads:** Place, align, and validate strategic construction slots.
- **Scenery Prop Staging:** Select from the categorized asset palette (`All`, `Trees`, `Rocks`, `Caves`, `Ruins`, `NPCs`), drag to position, adjust scale ($0.2\times$ to $2.5\times$), flip horizontally (`F`), and view real-time isometric depth sorting on canvas.
- **Full History:** Complete Undo/Redo (`Ctrl+Z`, `Ctrl+Y`) for all editing actions.
- **Direct Code & Asset Export:** Generates clean TypeScript `MapDefinition` code, formatted JSON assets, and saves directly to disk via Vite dev middleware (`/api/dev/save-map`).

### Hotkey Reference
| Key | Action |
|---|---|
| `P` | Switch to **Path Mode** (add/edit waypoint tracks) |
| `T` | Switch to **Tower Mode** (place defensive slot pads) |
| `O` | Switch to **Portal Mode** (place spawn portals) |
| `D` | Switch to **Prop Mode** (place 2.5D scenery assets) |
| `F` | **Flip Prop Horizontally** (mirrors selected prop) |
| `Del` / `Backspace` | **Delete** selected waypoint, slot, portal, or prop |
| `Ctrl + Z` | **Undo** last change |
| `Ctrl + Y` | **Redo** undone change |

---

## 🏆 Competitive Ranking & Elo System

A skill-based competitive rating system tracks player progress across online matches:

### Elo Rating Algorithm
- All new players start with a baseline Elo of **1000**.
- Post-match rating adjustments use standard logistic expectation with dynamic K-factors:
  $$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}$$
  $$\Delta R_A = K \times (S_A - E_A)$$
- **Guaranteed Stakes:** Winners always gain at least $+1$ Elo and losers lose at least $-1$ Elo, even during extreme rating disparities.

### Rank Tiers & Badges
| Tier | Elo Range | Visual Badge | Description |
|---|---|---|---|
| 🥉 **Bronze Tier** | 0 – 1199 | Bronze Emblem | Novice Tactician |
| 🥈 **Silver Tier** | 1200 – 1499 | Silver Crest | Veteran Commander |
| 🥇 **Gold Tier** | 1500+ | Golden Royal Crown | Master Strategist |

- **Guest Authentication:** Instant play supported via guest account generation, storing session tokens and Elo ratings persistently in MongoDB or localStorage.

---

## 🏗️ Tech Stack & Monorepo Architecture

The repository is structured as an **npm Workspaces** monorepo:

```
TD_Game/
├── app/
│   ├── client/                  # Frontend Web Application
│   │   ├── src/
│   │   │   ├── componenets/     # React UI: Lobby, Draft, HUD, Editor, Modals
│   │   │   ├── game/            # Phaser 3 Game Scenes, Stages, and Actors
│   │   │   ├── audio/           # Sound Effects & Audio Manager
│   │   │   └── network/         # Colyseus Client Room Connection Handlers
│   │   └── public/assets/       # Maps, Props, Spritesheets, Icons, Audio
│   │
│   └── server/                  # Authoritative Multiplayer Game Server
│       ├── src/
│       │   ├── rooms/           # GameRoom.ts (State machine, tick, combat loop)
│       │   ├── game/            # Phases, damage channels, targeting algorithms
│       │   ├── auth/            # JWT, Google OAuth, Guest auth routes
│       │   └── models/          # MongoDB User & Guest schemas
│       └── test/                # 121 Mocha integration & balance tests
│
└── packages/
    └── shared/                  # Shared Game Core (Shared by Client & Server)
        └── src/
            ├── schema/          # Colyseus Schema definitions (RoomState, Mob, Tower)
            ├── game/            # Balance math, maps, props catalog, message keys
            └── data/            # mobs.json, towers.json, rules.json
```

### Core Technologies
- **Client:** React 19, Vite 8, Tailwind CSS v4, Phaser 3/4, Colyseus JS SDK.
- **Server:** Node.js (>= 22.0.0), Colyseus 0.18, Express 5, MongoDB / Mongoose, tsx.
- **Shared:** TypeScript, `@colyseus/schema`.
- **Testing:** Mocha, `@colyseus/testing`.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** `>= 22.0.0`
- **npm:** `>= 10.0.0`

### 1. Installation
Clone the repository and install dependencies across all workspaces:

```bash
git clone https://github.com/Cltr-Alt-F4/un-named-TD-game.git
cd TD_Game
npm install
```

### 2. Build the Shared Package
> [!IMPORTANT]
> The `@root/shared` package is imported from its compiled `dist/` directory. You **must** build it once before running the server, client, or tests:

```bash
npm run build:shared
```

### 3. Environment Configuration

Create `.env` files for both the server and client:

#### Server Configuration (`app/server/.env`)
```env
PORT=2567
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key
# Optional MongoDB connection (falls back to in-memory/guest if absent):
MONGODB_URI=mongodb://localhost:27017/td_game
```

#### Client Configuration (`app/client/.env`)
```env
VITE_SERVER_URL=ws://localhost:2567
```

### 4. Running the Development Servers

Open two terminals (or use your process manager):

```bash
# Terminal 1: Start Colyseus Game Server
npm run dev:server    # Server runs on ws://localhost:2567

# Terminal 2: Start Vite Client
npm run dev:client    # Client runs on http://localhost:5173
```

*(Optional)* If you plan on frequently editing files in `packages/shared/src/`, keep the TypeScript compiler in watch mode:

```bash
npm run dev:shared    # Watches and recompiles packages/shared automatically
```

### 5. Production Builds

```bash
npm run build:shared   # Compiles shared schemas and types
npm run build:server   # Builds server into app/server/build/
npm run build:client   # Generates production bundle in app/client/dist/
```

---

## 🧪 Testing & Quality Assurance

The server workspace houses an automated test suite featuring **121 passing tests** covering every aspect of match logic, simulation math, network state changes, and balance limits:

```bash
npm test
```

### What the Test Suite Verifies
- **Balance Shape Guards:** Enforces strictly increasing tower upgrade costs, positive mob bounties, valid leak damages, and sane deploy caps across `mobs.json` and `towers.json`.
- **Combat Mathematics:** Tests Physical armor mitigation, Mental channel resolve cracking, damage amplification, and slow effect non-stacking.
- **Map & Path Simulation:** Verifies spline interpolation, segment heading calculations, lane spread bands, and portal derivation for forks and merges.
- **Match Lifecycle State Machine:** Full round-based 2-2-2 draft execution, countdown timeouts, reconnection seat-holding (120s), and core health depletion.
- **Elo & Ranking Math:** Validates rating calculation, minimum win/loss bounds, and rank tier thresholds.

---

## ⚖️ Balance & Modding Guide

All game balance parameters reside in human-readable JSON files inside `packages/shared/src/data/`:

- **`mobs.json`**: HP, speed, armor, resolve, bounty, cost, and leak damage for all siege units (`grunt`, `runner`, `tank`, `spearman`, `champion`, `spirit`, etc.).
- **`towers.json`**: Build costs, upgrade costs, ranges, fire rates, damage channels (`physical` vs `mental`), and targeting rules for all towers (`basic`, `archer`, `cannon`, `bomb`, `bell`, `spear`, `gun`).
- **`rules.json`**: Starting gold, round draft durations, countdown clocks, deploy stagger times, base Core HP, and deep-unit income bonus thresholds.

### Rebalancing Workflow
1. Modify values in `packages/shared/src/data/`.
2. Recompile the shared package:
   ```bash
   npm run build:shared
   ```
3. Run the balance shape verification tests:
   ```bash
   npm test
   ```
4. If tests pass, your changes are immediately active on both server and client!

---

## 📜 License & Acknowledgments

- **License:** Proprietary / Unlicensed for commercial use (see repository terms).
- **Art & Audio:** Hand-crafted 2.5D isometric game assets and cultural motifs inspired by the rich artistic heritage of ancient Myanmar kingdoms.
