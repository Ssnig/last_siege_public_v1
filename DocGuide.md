# Dev Team Inline Documentation Cheat Sheet
Reference : https://tsdoc.org

> **Rule:** Don't document *what* the code does (TypeScript types already do that). Document **why** it exists, **side effects**, and **gotchas**.

---

## The Basics (TSDoc Standard)

Use `/** ... */` block comments above classes, methods, functions, and interface properties.

| Tag | Purpose | When to use |
| :--- | :--- | :--- |
| **First line** | Short summary | **Always.** Appears directly in hover tooltips in VS Code. |
| `@remarks` | Deep dives & gotchas | Performance warnings, ordering caveats, or state rules. |
| `@param` | Parameter context | Explain expectations (skip repeating types). |
| `@returns` | Return value behavior | Describe returns, edge cases, or `null`/`undefined` states. |
| `@throws` | Error conditions | List custom errors or validation failures. |
| `@example` | Usage sample | For complex helpers or reusable components. |

---

## Stack Examples

### 1. React (`.tsx`) — UI Components & Hooks
Focus on **state behavior**, **prop quirks**, and **trigger events**.

```tsx
/**
 * Interactive HUD panel displaying the local player's active health and mana bars.
 *
 * @remarks
 * Listens to state changes bound via Colyseus hooks. Rerenders are throttled
 * to match the 60fps frame rate tick.
 *
 * @example
 * <PlayerHUD playerId={currentSessionId} onLowHealth={() => playWarningSound()} />
 * 
 */
export const PlayerHUD: React.FC<PlayerHUDProps> = ({ playerId, onLowHealth }) => {
  // ...
};
```

### 2. Phaser (`.ts`) — Scenes, Sprites & Game Loop
Focus on **lifecycle bounds**, **rendering costs**, and **physics/memory rules**.

```typescript
/**
 * Spawns a recycled spell visual effect sprite at target world coordinates.
 *
 * @remarks
 * **Performance Warning:** Uses an internal pool (`SpellEffectGroup`). 
 * Never call `.destroy()` on the returned game object; use `.killAndHide()` 
 * or let the auto-tween handle cleanup to prevent GC stutter.
 *
 * @param scene - Active Phaser scene managing the particle pipeline.
 * @param x - Target world X position in pixels.
 * @param y - Target world Y position in pixels.
 * @returns The active Phaser Image sprite instance from the pool.
 */
export function castFireballEffect(
  scene: Phaser.Scene, 
  x: number, 
  y: number
): Phaser.GameObjects.Image {
  // ...
}
```

### 3. Colyseus (`.ts`) — Rooms, State & Network Handlers
Focus on **async updates**, **server-side validation**, and **client authority rules**.

```typescript
/**
 * Handles incoming `player_move` messages from clients and validates trajectory.
 *
 * @remarks
 * Executes server-side speed reconciliation. If distance exceeds `MAX_DELTA`, 
 * the movement request is discarded and a state correction packet is dispatched.
 *
 * @param client - The Colyseus client connection that sent the input packet.
 * @param input - Client movement payload containing movement vector and timestamp.
 * @throws {ValidationError} If input payload fails schema checks.
 */
export function handlePlayerMovement(client: Client, input: MoveInputPayload): void {
  // ...
}
```

---

## Recommended Tooling

* **VS Code Hotkey:** Type `/**` immediately above any function or variable and hit `Enter` to auto-populate TSDoc tags based on signature.
* **ESLint Plugin:** Install `eslint-plugin-tsdoc` to flag invalid TSDoc syntax during builds:
  ```bash
  npm install --save-dev eslint-plugin-tsdoc
  ```

### 4. Golden Rules for Game Stack Inline Docs

1. Colyseus Schemas: Always note if a variable auto-syncs across the network and who owns authority (Client vs. Server).
Example :
```ts
/**
 * Shared state representation of a player entity inside the game room.
 *
 * @remarks
 * **Network Sync Rules:**
 * - `x` and `y` properties are mutated frame-by-frame on the server at 20Hz.
 * - `inventory` is marked as `@type(["string"])` - avoid mutating array items 
 *   directly; always use `.push()` or `.splice()` to trigger Colyseus delta sync.
 */
export class PlayerSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}
```
2. Network Payloads: Document direction (`Client -> Server` or `Server -> Client`) and exact string event keys. Example : 
```ts
/**
 * Action payload dispatched when a player requests to equip an item.
 * Direction: Client -> Server (`room.send("req_equip_item", payload)`)
 *
 * @param slotIndex - Target hotbar slot index (0 to 9).
 * @param itemId - Unique UUID of the item stored in player state.
 */
export interface EquipItemPayload {
  slotIndex: number;
  itemId: string;
}
```
3. Phaser Assets: Document texture/audio string keys and memory pooling/cleanup rules to prevent leaks. Example :
```ts
/**
 * Main combat scene handling local physics and player rendering.
 *
 * @remarks
 * **Asset Dependencies:** Requires `preloadAssets()` to have been called in 
 * `BootScene`. Expects the texture key `"spritesheet_hero"` to be preloaded in memory.
 * 
 * **Cleanup Warning:** Registers global window resize listeners. Ensure 
 * `scene.events.once(Phaser.Scenes.Events.SHUTDOWN)` is invoked to remove listeners.
 */
export class MainScene extends Phaser.Scene { ... }
```
4. React-Phaser Bridges: Explicitly mark high-frequency updates (Phaser game loop) vs low-frequency state updates (React HUD). Example :
```ts
/**
 * React hook that binds to the current Colyseus room session state.
 *
 * @remarks
 * **UI Bridge Notice:** Triggers a React state update ONLY when high-level room 
 * state changes (`room.state.status`). Do NOT use this for high-frequency player 
 * position updates; consume those directly inside Phaser's update loop instead.
 *
 * @returns The active room instance or null if disconnected.
 */
export function useColyseusRoom(): Room | null { ... }
```
