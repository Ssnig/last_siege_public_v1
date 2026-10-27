# 🏯 1v1 Real-Time Multiplayer Tower Defense: Ancient Burma

[![Colyseus 0.18](https://img.shields.io/badge/Colyseus-0.18-blue.svg)](https://colyseus.io/)
[![React 19](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3%2F4-ff69b4.svg)](https://phaser.io/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.3-38bdf8.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%2F6.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests Passing](https://img.shields.io/badge/Tests-133%20passing-brightgreen.svg)]()

An asymmetric, competitive 1v1 real-time multiplayer tower defense game set in the rich historical eras and landscapes of ancient Burma (Bagan, Konbaung, Inle, Mandalay, and beyond). Built from the ground up with **React 19**, **Phaser 3**, and **Colyseus 0.18** within a modular TypeScript monorepo.

---

## 📖 Table of Contents
- [🌟 Key Features](#-key-features)
- [⚔️ Asymmetric Gameplay & Match Lifecycle](#️-asymmetric-gameplay--match-lifecycle)
- [🏰 The 10 Strategic Defense Towers](#-the-10-strategic-defense-towers)
- [🗡️ Siege Units & Match Draft Randomization](#️-siege-units--match-draft-randomization)
- [🗺️ The 9 Canonical Battlefields & Real Map Reveal](#️-the-9-canonical-battlefields--real-map-reveal)
- [🎶 Dynamic Soundtrack & Audio System](#-dynamic-soundtrack--audio-system)
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
- **Four Synchronized Match Stages:** Dynamic transitions spanning **Map Reveal Showcase**, round-based **Draft Stage**, tactical **Building & Queue Buffering Stage**, and action-packed real-time **Combat Stage**.
- **10 Unique Defense Towers:** Differentiated attack cadences, ranges, and special tactical effects—from rapid-firing Archer Towers (2 shots/sec) to the heavy Cannon Tower inflicting a 25% movement speed slow on-hit.
- **Dynamic 15-Unit Pool with Match Randomization:** 15 distinct siege units featuring custom 4-frame isolated walk animations. In each match, the server draws 10 units at random for the draft pool, ensuring fresh tactical compositions every game.
- **Dual Damage Channels:** Deep combat mathematics featuring **Physical Damage** (mitigated by armor) and **Mental Damage** (penetrates armor, shatters resolve, cracks units for amplified subsequent damage, and inflicts slows).
- **Real Battlefield Reveal Screen:** When entering combat, players are presented with an authentic full-color illustration of the rolled map framed in antique gold filigree, displaying lane count, portal layout, and terrain lore.
- **Phase-Synced Dynamic BGM:** Smooth crossfades between dedicated orchestral tracks for Lobby, Map Reveal & Draft, and In-Game Building & Combat.
- **Unified & Streamlined HUD:** Cohesive gold-and-slate color palette across both Attacker and Defender interfaces, with clean circular timers replacing clutter.
- **9 Canonical Battlefields:** Hand-crafted, multi-lane historical maps featuring branching paths, forks, merges, and diverse environmental themes.
- **Atmospheric 2.5D Scenery Props:** Hand-drawn 2.5D isometric scenery assets (banyans, pagodas, torana arches, boulders, caves, bullock carts, village shrines) and ambient animated NPCs with dynamic isometric Y-depth sorting.
- **Full In-Browser Level Editor (`/dev/editor`):** Visual pathing and waypoint tool, portal charge configuration, tower placeholder scaling, scenery prop staging, and direct file persistence.
- **Competitive Elo Rating & Tier Ranks:** Dynamic Elo rating adjustments, seasonal rank tiers (Bronze, Silver, Gold), and guest session persistence.

---

## ⚔️ Asymmetric Gameplay & Match Lifecycle

Matches transition smoothly through synchronized phases orchestrated by the authoritative `GameRoom` server state machine:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   MAP REVEAL    │ ────> │   DRAFT STAGE   │ ────> │ BUILDING STAGE  │ ────> │  COMBAT STAGE   │
│ Authentic Art   │       │ 2-2-2 Round Pick│       │ Towers & Queues │       │ Real-Time Siege │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 1. Map Reveal Showcase (6s Countdown)
- Upon matchmaking, the battlefield for the duel is authoritatively determined.
- A royal showcase presents the map's authentic full-color artwork (`map.jpg`), accompanied by its historical name, lane configurations, and tactical description.
- Plays `DraftPhase.mp3` with ambient royal immersion.

### 2. Phase 1: Draft Stage (Round-Based 2-2-2 Pick)
- Players construct their active match decks through a 3-round alternating draft (6 cards selected each).
- In each round, both players pick 2 cards simultaneously from 4 offered cards.
- **Attacker** selects from 10 randomly drawn siege units from the 15-unit master roster.
- **Defender** selects from the 10 available defense towers.
- Includes turn timers, deck synergy tooltips, live previews, and ready confirmations.

### 3. Phase 2: Building & Deploy Buffering Stage
- **Defender Actions:**
  - Build towers on designated strategic slot pads using starting gold.
  - Upgrade constructed towers through multiple tiers to increase range, fire rate, and damage.
  - Sell towers with partial gold refunds to adapt to the attacker's drafted composition.
- **Attacker Actions:**
  - Plan unit waves by queuing units into **Portal Deploy Buffers**.
  - Assign specific route portals for multi-track battlefields.
  - Earn passive siege preparation gold over time.
- Seamlessly crossfades into `InGameMusic.mp3`.

### 4. Phase 3: Real-Time Combat Stage
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

## 🏰 The 10 Strategic Defense Towers

Every tower features tailored attack cadences, damage profiles, projectile behaviors, and sound signatures:

| Tower | Role & Description | Attack Speed | Damage Channel | Special Tactical Properties |
|---|---|---|---|---|
| 🏹 **Archer Tower** | Rapid-fire anti-swarm sentry | **1 shot / 0.5s** (2.0/s) | Physical | High single-target DPS against unarmored runners |
| 💥 **Cannon Tower** | Heavy artillery bombardier | **1 shot / 3.0s** (0.33/s) | Physical (AoE) | **On-Hit Slow:** Reduces victim speed by 25% (0.25x) for 1.5s |
| 💣 **Bomb Tower** | High-explosive siege mortar | **1 shot / 2.0s** (0.5/s) | Physical (AoE) | Wide-radius blast damage for dense enemy clusters |
| 🔔 **Bell Tower** | Sacred sonic resonator | **1 pulse / 1.5s** (0.67/s) | Mental | Ignores physical armor; cracks mob resolve and inflicts mental break |
| 🔱 **Spear Tower** | High-pierce anti-cavalry ballista | **1 shot / 1.0s** (1.0/s) | Physical | Armor-shredding linear penetration |
| 🔫 **Gun Tower** | Precision flintlock barricade | **1 shot / 1.0s** (1.0/s) | Physical | Consistent mid-range burst damage |
| 🌊 **Water Cannon** | High-pressure hydraulic torrent | **1 burst / 1.8s** (0.56/s) | Physical | Knockback pressure and track suppression |
| 🦁 **Chinthe Statue** | Guardian lion monolith | **1 strike / 2.2s** (0.45/s) | Mental | Royal spiritual ward that breaks enemy spirit |
| 🐉 **Dragon Tower** | Mythical pyromancer spire | **1 breath / 1.2s** (0.83/s) | Physical | Continuous frontal cone incinerating light infantry |
| 🎯 **Sein Pyaung** | Long-range imperial sniper | **1 shot / 3.5s** (0.29/s) | Physical | Map-wide range targeting the highest-threat unit |

---

## 🗡️ Siege Units & Match Draft Randomization

The game features **15 distinctive siege units**, each with 4-frame isolated walk cycles, custom speed bands, armor ratings, and resolve:

```text
Master Roster (15 Units):
1. Cavalry (horse_rider)     6. Elephant Rider        11. Forest Bandit
2. Royal Guard (sar_bal_gyi) 7. Monkey Warrior        12. Mythical Ogre (belu)
3. Winged Nat (gya_pu)       8. Say Sayar (Healer)    13. Mountain Brute
4. Spirit Medium (a_ba)      9. Shield Defender       14. War General
5. Bush Sneak (chon_toe)    10. Doe Pat Drummer       15. Sorceress (sone_ma)
```

- **Per-Match Draft Randomization:** For every match, the authoritative server randomly selects **10 units** from the master roster. Both players share this 10-unit pool during the drafting phase.
- **Isolated Spritesheet Slicing:** Spritesheets are composed with connected-component separation and transparent border padding, ensuring zero frame bleeding, weapon clipping, or animation cutoff.
- **Full-Body Character Scaling:** Anchored feet contact points ($y_{\text{origin}} = 0.917$) ensure that all 15 units remain grounded on isometric paths without visual clipping.

---

## 🗺️ The 9 Canonical Battlefields & Real Map Reveal

Every battlefield is historically themed after significant regions and eras of ancient Burma, fully authored with unique waypoint tracks, spawn portals, and tower pads:

| # | Map Name | ID | Theme & Terrain | Portals | Lanes / Tracks |
|---|---|---|---|---|---|
| **1** | **Konbaung Plains** | `konbaung` | Central plains, stilt villages, banyan groves, stream bridge | 1 | Single-lane starter route |
| **2** | **Bagan Terracotta** | `bagan` | Red-brick plains, towering stupas, ruin walls, dry savanna | 1 | Single serpentine lane |
| **3** | **Inle Lake** | `inle` | Aquatic palace pool, stone balustrades, arched bridges | 1 | Serpentine stone concourse |
| **4** | **Mandalay Palace** | `mandalay` | Palace battlements, golden pyatthat spires, royal moat | 1 | Symmetrical palace courtyard |
| **5** | **Innwa Fort** | `innwa` | Fortified citadel, redoubts, and stone watchgrounds | 1 | Fortified perimeter loop |
| **6** | **Bago Jungle Karst** | `bago` | Tropical rainforest, overgrown brick ruins, karst cave mouths | 2 | Split converging jungle tracks |
| **7** | **Deserted Sands** | `deserted` | Arid sandstone canyons, sun-bleached earth, footbridges | 1 | Single canyon bypass |
| **8** | **Twister Canyon** | `twister` | Deep eroded gulch with dual tracks and stream crossings | 2 | Dual tracks (`upper` & `lower`) |
| **9** | **River Delta** | `river` | River delta archipelago with winding marsh islands | 2 | Dual tracks (`north` & `south`) |

---

## 🎶 Dynamic Soundtrack & Audio System

The audio subsystem provides smooth volume fading and phase-aware soundtrack transitions:

- **`Lobby.mp3`**: Plays across Landing, Main Menu, Room Creation, and Matchmaking.
- **`DraftPhase.mp3`**: Smoothly crossfades in during the Pre-Draft Map Reveal and Draft Selection phases.
- **`InGameMusic.mp3`**: Energizes the Building and Combat stages with pulse-pounding rhythm.
- **`Soundtrack1.mp3`**: Registered ambient soundtrack asset.
- **Clean Audio Controls:** Persistent volume sliders and mute toggles stored in `localStorage` without UI clutter.

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
- **Tower Slot Pads & Visual Scale:** Place, align, scale, and preview defensive construction slots matching in-game dimensions.
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

## 🔊 In-Browser Sound Studio & Audio Editor

The game features a dedicated in-browser **Sound Studio** accessible directly at `/sounds` or `/dev/sounds` (or via the **Sound Studio** button in the in-game Settings modal):

```text
Studio URL: http://localhost:5173/sounds (or /dev/sounds)
```

### Studio Workbench Features
- **Individual Tower Sound Auditioning:** Inspect and trigger tailored shooting and impact sounds for all 10 defense towers (`archer`, `cannon`, `bomb`, `bell`, `spear`, `gun`, `water_cannon`, `chinthe`, `dragon`, `sein_pyaung`).
- **Interactive Oscillogram Waveforms:** Real-time animated canvas visualizers render live audio output waves upon sound playback.
- **Pitch Tuning ($0.8\times$ to $1.2\times$):** Fine-tune pitch multipliers in real time to preview variations before committing changes.
- **Rapid-Fire Volley Testing:** Simulate a sustained 5-shot attack volley timed precisely to each tower's in-game fire rate (e.g., Archer @ 0.5s intervals, Cannon @ 3.0s intervals).
- **Combat Sequence Simulation:** Test the full combat acoustic loop: `Shoot` $\to$ `Simulated Projectile Travel` $\to$ `Impact Burst`.
- **Drag-and-Drop Sound Replacement:** Drop or upload custom audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`) directly onto any tower's Shoot or Impact slot.
- **Vite Dev Middleware Persistence:** Custom audio uploads are written directly to `app/client/public/assets/sfx/towers/` via Vite dev endpoints (`/api/dev/save-sound`), persisting across page reloads.
- **One-Click Procedural Reset:** Instantly revert custom sound overrides back to procedural Web Audio synthesis with the "Reset to Default Synthesis" button (`/api/dev/delete-sound`).
- **Combat & Ambient Soundboard:** Audition global combat stings (War Drums, Victory Fanfare, Defeat Dirge), mob death cries, and base core alerts.
- **Soundtrack Music Browser:** Inspect and audition all background music themes with instantaneous pause/play controls.
- **Zero Audio Interference:** Background music is automatically silenced while inside the Sound Studio, allowing clear listening and tuning of individual sound effects.

---

## 🎓 Interactive War Academy & Tutorial Phase

The game features a dedicated in-browser **War Academy & Tutorial** accessible at `/tutorial` or `/academy` (as well as via the **Tutorial** button on the Main Landing Page, the Match Lobby, and the in-game Settings modal):

```text
Academy URL: http://localhost:5173/tutorial (or /academy)
```

### The Two Strategic Disciplines
The War Academy provides tailored interactive curriculums with live sandbox simulators for both sides of the siege:

#### 🛡️ Defender Academy ("The Citadel Commander")
- **Module 1: Construction & Choke Points:** Teaches placing defense towers on stone pads using starting gold (350g), positioning on high-value corners/bends to maximize firing duration, and visualizing range radii.
- **Module 2: Dual Damage Channels & The Armor Counter:** Teaches why Physical damage (Archer, Gun, Cannon) is blunted by enemy Armor, how the Sacred Bell Tower deals Mental damage that completely bypasses armor and cracks resolve, and how the Spear Tower uses 50% Armor Piercing to shred heavy vanguards.
- **Module 3: Tier Upgrades & The 70% Sell Refund:** Demonstrates upgrading towers from Tier 1 to Tier 3 for increased DPS, range, and fire rate, as well as selling misplaced towers for an instant 70% gold refund.
- **Module 4: Target Aggro & Crowd Control Synergy:** Demonstrates how Shield Bearers redirect single-target tower fire with Royal Taunt, and how Cannon's 25% on-hit slow creates dense clusters for AoE Bomb and Bell explosions. Includes an interactive Citadel Mastery Check quiz!

#### ⚔️ Attacker Academy ("The Siege Warlord")
- **Module 1: Portals, Charges & Deploy Buffer:** Teaches queuing units into the deploy buffer with gold, managing portal charges (starts with 3, recharges over time), and launching squads in staggered formation.
- **Module 2: The Recurring Income Engine:** Explains how deploying units permanently scales the recurring Income Rate (paid out every 10s), plus deep-penetration gold bonuses earned when troops push past 50% track distance.
- **Module 3: The Holy Trinity Siege Formation:** Demonstrates the optimal wave composition: Vanguard Tank (Shield Bearer taunts single-target fire) + Support Core (Doe Pat Drummer +40% speed boost & Say Sayar healing aura) + Infiltration Payload (Monkeys or War Elephant).
- **Module 4: Palace Infiltration & Victory Conditions:** Teaches Core Leak Damage values (Monkey = 1 HP, Sar Bal Gyi = 3 HP, Belu = 5 HP, War Elephant = 10 HP) and how to breach the Defender's Core from 20 to 0 HP. Includes an interactive Warlord Mastery Check quiz!

### 💡 In-Match Contextual Battle Coach
- **Phase Guidance Banners:** Discrete coach tips appear at the top of each match phase (Map Reveal, Draft, Building, Combat) advising players on immediate tactical priorities.
- **HUD Quick Guide (`[❓ Guide]`):** A one-click slideover reference card available directly on the Game HUD so players can look up damage channels, income mechanics, and role objectives without leaving their live match!

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
│   │   │   ├── components/     # React UI: Lobby, Draft, HUD, Editor, Modals
│   │   │   ├── game/            # Phaser 3 Game Scenes, Stages, and Actors
│   │   │   ├── audio/           # BGM Manager & Sound Effects Subsystem
│   │   │   └── network/         # Colyseus Client Room Connection Handlers
│   │   └── public/assets/       # Maps, Props, Spritesheets, Icons, Audio
│   │
│   └── server/                  # Authoritative Multiplayer Game Server
│       ├── src/
│       │   ├── rooms/           # GameRoom.ts (State machine, tick, combat loop)
│       │   ├── game/            # Phases, damage channels, targeting algorithms
│       │   ├── auth/            # JWT, Google OAuth, Guest auth routes
│       │   └── models/          # MongoDB User & Guest schemas
│       └── test/                # 133 Mocha integration & balance tests
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

The server workspace houses an automated test suite featuring **133 passing tests** covering every aspect of match logic, simulation math, network state changes, and balance limits:

```bash
npm test
```

### What the Test Suite Verifies
- **Balance Shape Guards:** Enforces strictly increasing tower upgrade costs, positive mob bounties, valid leak damages, and sane deploy caps across `mobs.json` and `towers.json`.
- **Tower Firing Cadences & Slow On-Hit:** Confirms attack rates for Archer (0.5s), Gun (1.0s), Spear (1.0s), Bomb (2.0s), and Cannon (3.0s) as well as the Cannon on-hit 25% slow duration.
- **Combat Mathematics:** Tests Physical armor mitigation, Mental channel resolve cracking, damage amplification, and slow effect non-stacking.
- **Map & Path Simulation:** Verifies spline interpolation, segment heading calculations, lane spread bands, and portal derivation for forks and merges.
- **Match Lifecycle State Machine:** Pre-draft map reveal countdown, round-based 2-2-2 draft execution with match mob-pool randomization, countdown timeouts, reconnection seat-holding (120s), and core health depletion.
- **Elo & Ranking Math:** Validates rating calculation, minimum win/loss bounds, and rank tier thresholds.

---

## ⚖️ Balance & Modding Guide

All game balance parameters reside in human-readable JSON files inside `packages/shared/src/data/`:

- **`mobs.json`**: HP, speed, armor, resolve, bounty, cost, and leak damage for all 15 siege units.
- **`towers.json`**: Build costs, upgrade costs, ranges, fire rates, damage channels (`physical` vs `mental`), slow on-hit mechanics, and targeting rules for all 10 towers.
- **`rules.json`**: Starting gold, map reveal durations, round draft durations, countdown clocks, deploy stagger times, base Core HP, and deep-unit income bonus thresholds.

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
