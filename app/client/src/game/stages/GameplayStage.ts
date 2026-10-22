import Phaser from "phaser";
import { Callbacks, Room } from "@colyseus/sdk";
import {
  MESSAGES,
  EFFECT_TYPES,
  samplePath,
  samplePathWithLateral,
  mapPath,
  mapPathIds,
  mapPortals,
  type MapDefinition,
  type Mob,
  type Projectile,
  type Tower,
  type Vec2,
  type YouEconomyPayload,
  type AttackerBufferPayload,
  TOWER_TYPES,
  MATCH_RULES,
  portalChargeRules,
  sellRefund,
  upgradeCost,
  tierAt,
  getTowerDesign,
} from "@root/shared";
import { UIButton } from "../ui/UIButton";
import { TowerCard } from "../ui/TowerCard";
import {
  UI_ASPECT,
  UI_BG_ASPECT,
  UI_BG_FRAMES,
  UI_BG_TEXTURE_KEY,
  UI_TEXTURE_KEY,
} from "../ui/uiAtlas";
import { UnitAnimationManager } from "../animation/UnitAnimationManager";
import { AmbientNPCManager } from "../npc/AmbientNPCManager";

/** Render order for the gameplay layers. */
export const DEPTH = {
  MAP_BG: 0,
  PATH_LAYER: 1,
  SLOTS_LAYER: 2,
  PORTAL_LAYER: 4,
  BASE_LAYER: 5,
  /**
   * Shared band for bodies that must occlude each other by depth (towers, mobs
   * and the UI that rides on them). Sorting both through {@link actorDepth}
   * keeps the drawing order tied to world y, so a mob lower on screen passes in
   * front of the tower it walks past instead of always rendering behind it.
   */
  ACTORS_LAYER: 10,
  PROJECTILES_LAYER: 20,
  UI_LAYER: 30,
} as const;

/**
 * Draw depth for a world-space body from its world y, so of two bodies the one
 * nearer the bottom of the map (larger y) draws on top.
 *
 * @remarks Phaser ignores `depth` for children of a Container, so these values
 * are applied by re-sorting {@link GameplayStage.actors} every frame rather
 * than by the display list.
 *
 * @param y - World y of the body's pivot (its "feet", where origin sits).
 * @returns A depth inside {@link DEPTH.ACTORS_LAYER} proportional to `y`.
 */
const actorDepth = (y: number): number => DEPTH.ACTORS_LAYER + y * 0.001;

export const MIN_CAMERA_ZOOM = 0.85;
export const MAX_CAMERA_ZOOM = 1.6;

/**
 * Pointer travel, in px, before a press counts as a camera drag.
 *
 * @remarks Keeps a click on a tower (select) or a slot (build) from nudging
 * the camera, while a real drag still pans right away.
 */
const CAMERA_DRAG_THRESHOLD = 6;

export interface GameplayStageOptions {
  room: Room;
  map: MapDefinition;
  role: "attacker" | "defender";
  economy?: YouEconomyPayload;
  gold?: number;
  deck?: string[];
}

type TowerSlot = { slotIndex: number; x: number; y: number };

/** A placed tower: its server id, schema record, and rendered sprite. */
type TowerRecord = {
  id: string;
  tower: Tower;
  sprite: Phaser.GameObjects.Sprite;
  levelBadge?: Phaser.GameObjects.Container;
};

/** A mob and the sprites that render it: body plus its health bar. */
type MobRecord = {
  /** Server id of the mob, used to resolve a tower's current target. */
  id: string;
  /** Last computed world x of the mob body. */
  x: number;
  sprite: Phaser.GameObjects.Sprite;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
};

/** A portal: its spin sprite plus the charge pips drawn above it. */
type PortalRecord = {
  sprite: Phaser.GameObjects.Sprite;
  pips: Phaser.GameObjects.Rectangle[];
  glow: Phaser.GameObjects.Arc;
};

/** Mob health-bar geometry, in world px. */
const MOB_HP_BAR = {
  width: 44,
  height: 6,
  offsetY: -46,
} as const;

/** Portal charge-pip geometry, in world px. */
const PORTAL_PIP = {
  radius: 4,
  gap: 11,
  offsetY: -72,
} as const;

/**
 * Renders the map (background, mob paths, tower slots, base, portals) once the draft
 * ends, plus the defender's build UI. `RoomState.towers` is the single source
 * of truth: placements round-trip through the server and render on `onAdd`.
 */
export class GameplayStage {
  private scene: Phaser.Scene;
  private room: Room;
  private map: MapDefinition;
  private role: "attacker" | "defender";

  private root?: Phaser.GameObjects.Container;
  private uiRoot?: Phaser.GameObjects.Container;
  /**
   * Child container of {@link root} holding every body that y-sorts against the
   * others (towers, mobs, health bars, level badges).
   *
   * @remarks Phaser ignores `depth` on Container children, so the `depth`
   * values from {@link actorDepth} only become real draw order here: the list
   * is re-sorted every frame. It is created after the portals (ground art that
   * bodies draw over) and before any actor sync so its index in `root` is the
   * only thing deciding its rank — children of `root` are drawn in add order.
   */
  private actors?: Phaser.GameObjects.Container;
  private paths: Phaser.Curves.Path[] = [];
  private portals: Map<string, PortalRecord> = new Map();
  /** Portal the deploy bar is currently dragging a unit over, if any. */
  private hoveredPortalId?: string;
  /** Latest attacker deploy-buffer snapshot, used to drive the portal pips. */
  private attackerBuffer?: AttackerBufferPayload;
  private towers: Map<number, TowerRecord> = new Map();
  private mobSprites: Map<Mob, MobRecord> = new Map();
  /** Mob records by server id, so a tower can find the mob it is shooting. */
  private mobsById: Map<string, MobRecord> = new Map();
  private projectileSprites: Map<Projectile, Phaser.GameObjects.Sprite> = new Map();

  private gold = 200;
  private deck: string[] = [];
  private selectedTowerType?: string;

  private deckCards: Map<string, TowerCard> = new Map();
  private deckObjects: Phaser.GameObjects.GameObject[] = [];
  private deckLayoutWidth = 0;
  private ghostTower?: Phaser.GameObjects.Sprite;
  private phaseBanner?: Phaser.GameObjects.Container;
  private goldText?: Phaser.GameObjects.Text;
  private goldFrame?: Phaser.GameObjects.Image;
  private startButton?: UIButton;
  private combatBanner?: Phaser.GameObjects.Container;
  private ambientNpcManager?: AmbientNPCManager;

  private baseHpFill?: Phaser.GameObjects.Rectangle;
  private baseHpText?: Phaser.GameObjects.Text;
  private baseHpBarWidth = 120;

  private selectedSlotIndex?: number;
  private rangeCircle?: Phaser.GameObjects.Arc;
  private actionButton?: UIButton;
  private upgradeButton?: UIButton;
  private sellButton?: UIButton;
  private towerInfoPanel?: Phaser.GameObjects.Container;
  private pendingBuild?: TowerSlot;
  private buildHighlight?: Phaser.GameObjects.Arc;

  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug = false;
  private onKeyDown?: (event: KeyboardEvent) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;

  // Camera Drag, Pinch-to-Zoom & Momentum Properties
  private isDragging = false;
  private isPinching = false;
  private initialPinchDistance = 0;
  private initialZoom = 1;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cameraVelocityX = 0;
  private cameraVelocityY = 0;
  /** Pointer position where the current drag started, for the move threshold. */
  private dragOriginX = 0;
  private dragOriginY = 0;
  /** `true` once the drag moved far enough to count as a camera pan. */
  private dragActive = false;
  private onCameraPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onCameraPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onCameraPointerUp?: () => void;
  private onCameraWheel?: (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => void;

  private unsubscribers: Array<() => void> = [];
  private combatStarted = false;
  private destroyed = false;

  /** Re-positions every mob and projectile sprite from authoritative state. */
  private onSceneUpdate = (): void => {
    this.updateMobs();
    this.updateProjectiles();
    this.updateTowerFacing();

    // Mobs move every frame, so the y-sort has to run with them: this is what
    // applies `actorDepth`, since Phaser ignores `depth` on Container children.
    this.actors?.sort("depth");
  };

  constructor(
    scene: Phaser.Scene,
    optionsOrMap: GameplayStageOptions | MapDefinition,
    defenderDeck?: string[],
    room?: any,
    gold?: number,
    myRole?: "attacker" | "defender",
  ) {
    this.scene = scene;

    if ("room" in optionsOrMap) {
      this.room = optionsOrMap.room;
      this.map = optionsOrMap.map;
      this.role = optionsOrMap.role;
      if (optionsOrMap.economy) {
        this.gold = optionsOrMap.economy.gold;
        this.deck = optionsOrMap.economy.deck;
      } else {
        this.gold = optionsOrMap.gold ?? 200;
        this.deck = optionsOrMap.deck ?? [];
      }
    } else {
      this.map = optionsOrMap;
      this.deck = defenderDeck ?? [];
      this.room = room;
      this.gold = gold ?? 200;
      this.role = myRole ?? "defender";
    }

    if (this.deck.length > 0) {
      this.selectedTowerType = this.deck[0];
    } else {
      this.selectedTowerType = "basic";
    }
  }

  create(): void {
    this.render();

    // A dedicated top-level container keeps every HUD element above the world
    // (map, units, towers). Child depth inside a single container is ignored,
    // so a separate container with a higher scene depth is required.
    this.uiRoot = this.scene.add.container(0, 0).setDepth(DEPTH.UI_LAYER);
    this.setupPortals();

    // Added after the portals (they are ground art bodies draw over) and before
    // any tower/mob sync below, so its index inside `root` is fixed for good.
    this.actors = this.scene.add.container(0, 0);
    this.root?.add(this.actors);

    this.setupCameraControls();
    this.setupDebugControls();

    if (this.role === "defender") {
      this.renderTowerDeck();
      this.renderStartButton();
      this.renderGoldIndicator();
    }
    this.renderPhaseBanner();
    this.setupTowerSync();
    this.setupMobSync();
    this.setupProjectileSync();
    this.setupBaseHpSync();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);

    // Canvas UI is kept for fallback, but hidden while React GameHUD is mounted
    this.uiRoot.setVisible(false);
  }

  /**
   * Applies an economy push from the server.
   */
  applyEconomy(payload: YouEconomyPayload): void {
    this.gold = payload.gold;
    this.refreshGold();
    if (payload.deck && payload.deck.length > 0) {
      this.deck = payload.deck;
      if (!this.selectedTowerType) {
        this.selectedTowerType = this.deck[0];
      }
    }
  }

  private refreshGold(): void {
    if (this.goldText) {
      this.goldText.setText(`${this.gold}`);
    }
    if (this.selectedSlotIndex !== undefined) {
      const record = this.towers.get(this.selectedSlotIndex);
      const slot = this.map.slots.find((s) => s.slotIndex === this.selectedSlotIndex);
      if (record && slot) {
        this.refreshTowerSelection(slot, record);
      }
    }
  }

  private setupPortals(): void {
    if (!this.scene.anims.exists("portal_spin")) {
      this.scene.anims.create({
        key: "portal_spin",
        frames: [
          { key: "spawn_2" },
          { key: "spawn_3" },
          { key: "spawn_4" },
          { key: "spawn_5" },
          { key: "spawn_6" },
        ],
        frameRate: 6,
        repeat: -1,
        yoyo: true,
      });
    }

    // Portal geometry comes from the shared `mapPortals` helper the server
    // validates deploys against, so ids here always match the deploy intents.
    // Maps that export explicit portal positions from the editor keep those
    // positions; otherwise portals fall back to the track spawn points. Tracks
    // that share a start (a fork) collapse into one portal; tracks with
    // different starts get one each.
    for (const portal of mapPortals(this.map)) {
      const sprite = this.scene.add
        .sprite(portal.x, portal.y, "spawn_2")
        .setOrigin(0.5, 0.72)
        .setDisplaySize(130, 130)
        .setDepth(DEPTH.PORTAL_LAYER + portal.y * 0.001)
        .play("portal_spin");
      this.root?.add(sprite);

      // Soft readiness glow, hidden until a portal actually has a charge.
      const glow = this.scene.add
        .circle(portal.x, portal.y - 26, 40, 0x22d3ee, 0.18)
        .setDepth(DEPTH.PORTAL_LAYER + 0.002)
        .setVisible(false);
      this.root?.add(glow);

      const maxCharges = portalChargeRules(portal).maxCharges;
      const pipRowWidth = Math.max(0, maxCharges - 1) * PORTAL_PIP.gap;
      const pips: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < maxCharges; i++) {
        const pip = this.scene.add
          .rectangle(
            portal.x - pipRowWidth / 2 + i * PORTAL_PIP.gap,
            portal.y + PORTAL_PIP.offsetY,
            PORTAL_PIP.radius * 2,
            PORTAL_PIP.radius * 2,
            0x22d3ee,
            0.9,
          )
          .setDepth(DEPTH.PORTAL_LAYER + 0.003)
          .setVisible(false);
        this.root?.add(pip);
        pips.push(pip);
      }

      // The attacker taps a portal to push their queue through it.
      if (this.role === "attacker") {
        const hit = this.scene.add
          .circle(portal.x, portal.y - 20, 52, 0xffffff, 0)
          .setDepth(DEPTH.PORTAL_LAYER + 0.004)
          .setInteractive({ useHandCursor: true });
        hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          this.room.send(MESSAGES.deploy, { portalId: portal.id });
        });
        this.root?.add(hit);
      }

      this.portals.set(portal.id, { sprite, pips, glow });
    }

    // Re-apply the last known charge state if a re-render rebuilt the portals.
    this.refreshPortalCharges();
  }

  /**
   * Applies an attacker deploy-buffer push, refreshing the portal charge pips.
   *
   * @remarks The buffer contents live in the React deploy bar; the stage only
   * needs the per-portal charge state so a player can tap a portal straight
   * from the map instead of hunting for the bar.
   */
  applyAttackerBuffer(payload: AttackerBufferPayload): void {
    this.attackerBuffer = payload;
    this.refreshPortalCharges();
  }

  /** Redraws every portal's charge pips from the last buffer snapshot. */
  private refreshPortalCharges(): void {
    const statusById = new Map(
      (this.attackerBuffer?.portals ?? []).map((portal) => [portal.id, portal]),
    );

    for (const [portalId, record] of this.portals) {
      const status = statusById.get(portalId);
      // The defender never receives the buffer, so their portals stay unlit.
      const charges = status?.charges ?? 0;

      record.glow.setVisible(charges > 0);
      record.pips.forEach((pip, index) => {
        pip.setVisible(!!status);
        pip.setFillStyle(index < charges ? 0x22d3ee : 0x64748b, index < charges ? 0.95 : 0.4);
      });
    }
  }

  /**
   * Resolves the map portal under a world point, if the point is close enough.
   *
   * @remarks Used by the deploy bar's drag-and-drop. The pointer is captured by
   * React during a drag, so Phaser never sees it; this is a manual hit test
   * matching the portal's on-screen footprint.
   *
   * @param x - World x coordinate.
   * @param y - World y coordinate.
   * @returns The portal id, or `null` when nothing is in range.
   */
  portalAtWorld(x: number, y: number): string | null {
    const HIT_RADIUS = 76;
    let best: string | null = null;
    let bestDistance = Infinity;

    for (const [id, record] of this.portals) {
      const distance = Phaser.Math.Distance.Between(x, y, record.sprite.x, record.sprite.y - 20);
      if (distance <= HIT_RADIUS && distance < bestDistance) {
        bestDistance = distance;
        best = id;
      }
    }

    return best;
  }

  /**
   * Highlights the portal a dragged unit is hovering, clearing the previous one.
   *
   * @param portalId - Portal id to highlight, or `null` to clear.
   */
  setPortalHover(portalId: string | null): void {
    const next = portalId ?? undefined;
    if (this.hoveredPortalId === next) return;

    const previous = this.hoveredPortalId ? this.portals.get(this.hoveredPortalId) : undefined;
    previous?.sprite.clearTint().setDisplaySize(130, 130);

    this.hoveredPortalId = next;
    const active = next ? this.portals.get(next) : undefined;
    active?.sprite.setTint(0x7dd3fc).setDisplaySize(156, 156);
  }


  private render(): void {
    // Tear down world-layer objects owned by the previous render first: root
    // destruction below frees their sprites, but the portal bookkeeping map and
    // the ambient manager's tweens must be dropped too, otherwise a re-render
    // leaves stale handles that block re-creation (and leak tweens).
    this.ambientNpcManager?.destroy();
    this.ambientNpcManager = undefined;
    this.portals.clear();
    this.hoveredPortalId = undefined;

    this.root?.destroy(true);
    this.root = this.scene.add.container(0, 0);
    // Destroyed with its parent; a rebuilt world creates it again in `create()`.
    this.actors = undefined;

    // A full-map hit area behind everything clears the current selection and
    // cancels any pending build/sale when the defender clicks empty ground.
    // Interactive objects added later (slots, towers, HUD) sit above it and win
    // Phaser's top-only hit test.
    if (this.role === "defender") {
      const zoneWidth = this.map.width || 1280;
      const zoneHeight = this.map.height || 720;
      const deselectZone = this.scene.add
        .zone(0, 0, zoneWidth, zoneHeight)
        .setOrigin(0, 0)
        .setInteractive(
          new Phaser.Geom.Rectangle(0, 0, zoneWidth, zoneHeight),
          Phaser.Geom.Rectangle.Contains,
        );
      deselectZone.on("pointerdown", () => this.clearSelection());
      this.root.add(deselectZone);
    }

    // Load and render map background (1280x720 at 0,0 aligning with slots, paths, portals, and base)
    const bgKey = this.scene.textures.exists(this.map.id) ? this.map.id : "konbaung";
    if (this.scene.textures.exists(bgKey)) {
      const bg = this.scene.add
        .image(0, 0, bgKey)
        .setOrigin(0, 0)
        .setDisplaySize(1280, 720)
        .setDepth(DEPTH.MAP_BG);
      this.root.add(bg);
    }

    // Spawn ambient scenic NPCs and un-interactable scenery objects
    this.ambientNpcManager = new AmbientNPCManager(this.scene, this.root);
    this.ambientNpcManager.spawnForMap(this.map.id);

    // Create path curves from every named track (or the single `path`).
    this.paths = [];
    for (const pathId of mapPathIds(this.map)) {
      const points = mapPath(this.map, pathId);
      if (!points || points.length === 0) continue;

      const curve = new Phaser.Curves.Path(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        curve.lineTo(points[i].x, points[i].y);
      }
      this.paths.push(curve);
    }

    // Render interactive tower slots (radius 36)
    this.map.slots.forEach((slot) => {
      const placeholder = this.scene.add
        .circle(slot.x, slot.y, 36, 0x8b4513, 0.5)
        .setDepth(DEPTH.SLOTS_LAYER)
        .setName("tower-slot");
      placeholder.setData("slotIndex", slot.slotIndex);

      if (this.role === "defender") {
        placeholder.setInteractive({ useHandCursor: true });

        placeholder.on("pointerover", () => {
          this.scene.registry.set("ui:overTowerSlot", true);
          if (!this.towers.has(slot.slotIndex)) {
            placeholder.setFillStyle(0xd2691e, 0.7);
            this.showGhostTower(slot);
          }
        });
        placeholder.on("pointerout", () => {
          this.scene.registry.set("ui:overTowerSlot", false);
          placeholder.setFillStyle(0x8b4513, 0.5);
          this.hideGhostTower();
        });
        placeholder.on(
          "pointerdown",
          (
            _pointer: Phaser.Input.Pointer,
            _localX: number,
            _localY: number,
            event: Phaser.Types.Input.EventData,
          ) => {
            this.scene.registry.set("ui:overTowerSlot", true);
            event?.stopPropagation();
            this.handleSlotClick(slot);
          },
        );
      } else {
        placeholder.on("pointerover", () => {
          this.scene.registry.set("ui:overTowerSlot", true);
        });
        placeholder.on("pointerout", () => {
          this.scene.registry.set("ui:overTowerSlot", false);
        });
        placeholder.on(
          "pointerdown",
          (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            this.scene.registry.set("ui:overTowerSlot", true);
            event?.stopPropagation();
          },
        );
      }

      this.root?.add(placeholder);
    });

    // Render base structure (HP is integrated into React HUD and floating above base)
    if (this.map.base) {
      const perMapTexture = `base_${this.map.id}`;
      const baseTexture = this.scene.textures.exists(perMapTexture)
        ? perMapTexture
        : "base_castle";

      const baseWidth = this.map.baseDisplaySize?.width ?? 260;
      const baseHeight = this.map.baseDisplaySize?.height ?? 260;
      const originX = this.map.baseOrigin?.x ?? 0.5;
      const originY = this.map.baseOrigin?.y ?? 0.5;

      const baseSprite = this.scene.add
        .sprite(this.map.base.x, this.map.base.y, baseTexture)
        .setOrigin(originX, originY)
        .setDisplaySize(baseWidth, baseHeight)
        .setDepth(DEPTH.BASE_LAYER);
      this.root.add(baseSprite);

      // Floating HP bar above base
      const hpBarWidth = 120;
      const hpBarHeight = 10;
      const hpBarX = this.map.base.x;
      const hpBarY = this.map.base.y + (this.map.baseHpOffsetY ?? -100);

      const hpBarBorder = this.scene.add
        .rectangle(hpBarX, hpBarY, hpBarWidth + 4, hpBarHeight + 4, 0x0f172a, 0.8)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x334155)
        .setDepth(DEPTH.BASE_LAYER + 0.1);

      const hpBarBg = this.scene.add
        .rectangle(hpBarX, hpBarY, hpBarWidth, hpBarHeight, 0x1e293b)
        .setOrigin(0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.2);

      const hpBarFill = this.scene.add
        .rectangle(hpBarX - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 0x22c55e)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.3);

      const hpText = this.scene.add
        .text(hpBarX, hpBarY - 14, `BASE: ${MATCH_RULES.coreHp}/${MATCH_RULES.coreHp} HP`, {
          fontSize: "11px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.BASE_LAYER + 0.4);

      this.baseHpFill = hpBarFill;
      this.baseHpText = hpText;
      this.baseHpBarWidth = hpBarWidth;

      this.root.add([hpBarBorder, hpBarBg, hpBarFill, hpText]);
    }
  }

  private setupDebugControls(): void {
    this.onKeyDown = () => {
      this.showDebug = !this.showDebug;
      this.toggleDebugGraphics();
    };
    this.scene.input.keyboard?.on("keydown-D", this.onKeyDown);

    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (this.showDebug) {
        console.log(
          `{ x: ${Math.round(pointer.worldX)}, y: ${Math.round(pointer.worldY)} }`,
        );
      }
    };
    this.scene.input.on("pointerdown", this.onPointerDown);
  }

  private toggleDebugGraphics(): void {
    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    if (!this.showDebug) return;

    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(DEPTH.PATH_LAYER);

    for (const path of this.paths) {
      this.debugGraphics.lineStyle(3, 0x22c55e, 0.7);
      path.draw(this.debugGraphics);
    }
  }

  private getActiveTowerType(): string | undefined {
    return (
      (this.scene.game.registry.get("selectedTowerType") as string | undefined) ||
      this.selectedTowerType ||
      (this.deck.length > 0 ? this.deck[0] : "basic")
    );
  }

  private handleSlotClick(slot: TowerSlot): void {
    const existing = this.towers.get(slot.slotIndex);
    if (existing) {
      this.selectTower(slot, existing);
      return;
    }

    // Tapping the already highlighted/pending slot confirms build directly
    if (this.pendingBuild?.slotIndex === slot.slotIndex) {
      this.confirmBuild();
      return;
    }

    const typeId = this.getActiveTowerType();
    if (!typeId) {
      console.log("No tower type selected");
      return;
    }

    const towerType = TOWER_TYPES[typeId];
    const cost = towerType?.tiers[0]?.cost ?? 0;
    if (!towerType || this.gold < cost) {
      console.log(`Not enough gold: need ${cost}, have ${this.gold}`);
      return;
    }

    this.requestBuild(slot);
  }

  /**
   * Arms a pending build on an empty slot and shows a confirm button.
   *
   * @remarks Tapping the ✓ BUILD button or tapping the slot a second time confirms.
   * Clicking elsewhere deselects via clearSelection.
   */
  private requestBuild(slot: TowerSlot): void {
    this.clearSelection();
    this.hideGhostTower();
    this.pendingBuild = slot;

    this.buildHighlight = this.scene.add
      .circle(slot.x, slot.y, 40, 0x22c55e, 0.15)
      .setStrokeStyle(3, 0x22c55e, 0.9);
    this.root?.add(this.buildHighlight);

    const typeId = this.getActiveTowerType();
    const towerType = typeId ? TOWER_TYPES[typeId] : undefined;
    const cost = towerType?.tiers[0]?.cost ?? 50;

    this.actionButton = this.createActionButton(
      slot,
      `✓ BUILD ${cost}g`,
      true,
      () => this.confirmBuild(),
    );
  }

  /** Sends the pending placement once the defender confirms it. */
  private confirmBuild(): void {
    const slot = this.pendingBuild;
    const typeId =
      this.getActiveTowerType() || this.selectedTowerType || "basic";
    if (!slot || !typeId) {
      this.clearSelection();
      return;
    }

    const towerType = TOWER_TYPES[typeId];
    const cost = towerType?.tiers[0]?.cost ?? 0;
    if (!towerType || this.gold < cost) {
      console.log("Build cancelled: type unavailable or insufficient gold");
      this.clearSelection();
      return;
    }

    console.log(
      `Sending place_tower for slot ${slot.slotIndex}, type: ${typeId}`,
    );
    this.room.send(MESSAGES.placeTower, {
      typeId,
      slotIndex: slot.slotIndex,
    });
    this.clearSelection();
  }

  private renderTowerDeck(): void {
    if (!this.deck || this.deck.length === 0) return;

    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];
    this.deckCards.clear();

    const deckX = 24;
    const cardWidth = 64;
    const cardHeight = cardWidth / 0.72;
    const gap = 12;
    const topY = 616;

    if (!this.selectedTowerType && this.deck.length > 0) {
      this.selectedTowerType = this.deck[0];
    }

    let placed = 0;
    this.deck.forEach((towerId) => {
      const tower = TOWER_TYPES[towerId];
      if (!tower) return;

      const x = deckX + placed * (cardWidth + gap);

      const tierCost = tower.tiers[0]?.cost ?? 0;
      const card = new TowerCard(
        this.scene,
        x,
        topY,
        cardWidth,
        cardHeight,
        tower,
        (selected) => this.selectDeckTower(selected.id),
        undefined,
        { label: `${tierCost}g` },
      );

      this.deckCards.set(towerId, card);
      this.deckObjects.push(card.container);
      this.uiRoot?.add(card.container);

      placed += 1;
    });

    this.deckLayoutWidth = placed * cardWidth + Math.max(0, placed - 1) * gap;
    this.updateDeckCardStyles();
    this.layoutGoldIndicator();
  }

  private selectDeckTower(towerId: string): void {
    this.selectedTowerType = towerId;
    this.updateDeckCardStyles();
  }

  private renderStartButton(): void {
    const buttonWidth = 150;
    const buttonHeight = buttonWidth / UI_ASPECT.button;

    this.startButton = new UIButton({
      scene: this.scene,
      x: 1150,
      y: 48,
      width: buttonWidth,
      height: buttonHeight,
      label: "START GAME",
      fontSize: 15,
      onClick: () => this.room.send(MESSAGES.startCombat, {}),
    });

    this.startButton.container.setDepth(DEPTH.UI_LAYER);
    this.uiRoot?.add(this.startButton.container);
  }

  /**
   * Renders the defender's gold readout, placed beside the tower deck.
   *
   * @remarks The coin emblem sits on the left of the frame, so the numeric
   * label is centered on the remaining width.
   */
  private renderGoldIndicator(): void {
    const width = 190;
    const height = width / UI_ASPECT.gold;

    this.goldFrame = this.scene.add
      .image(0, 0, UI_TEXTURE_KEY, "gold")
      .setDisplaySize(width, height)
      .setDepth(DEPTH.UI_LAYER);

    this.goldText = this.scene.add
      .text(0, 0, `${this.gold}`, {
        fontSize: "15px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI_LAYER);

    this.uiRoot?.add([this.goldFrame, this.goldText]);
    this.layoutGoldIndicator();
  }

  /**
   * Anchors the gold readout to the right of the tower deck.
   *
   * @remarks Called again whenever the deck is (re)built so the indicator
   * tracks a deck that arrives after creation.
   */
  private layoutGoldIndicator(): void {
    if (!this.goldFrame || !this.goldText) return;

    const width = this.goldFrame.displayWidth;
    const x = 24 + this.deckLayoutWidth + 24 + width / 2;
    const y = 660;

    this.goldFrame.setPosition(x, y);
    this.goldText.setPosition(x + width * 0.08, y);
  }

  private updateDeckCardStyles(): void {
    this.deckCards.forEach((card, towerId) => {
      card.setSelected(this.selectedTowerType === towerId);
    });
  }


  private showGhostTower(slot: TowerSlot): void {
    const typeId = this.getActiveTowerType();
    if (!typeId) return;
    this.hideGhostTower();

    const design = getTowerDesign(typeId);

    this.ghostTower = this.scene.add
      .sprite(slot.x, slot.y, design.textureKey)
      .setOrigin(design.origin.x, design.origin.y)
      .setDisplaySize(design.displaySize.width, design.displaySize.height)
      .setAlpha(0.5)
      .setDepth(actorDepth(slot.y));

    (this.actors ?? this.root)?.add(this.ghostTower);
  }

  private hideGhostTower(): void {
    this.ghostTower?.destroy();
    this.ghostTower = undefined;
  }

  /**
   * Selects a placed tower: draws its range, shows tier stats status, and
   * presents both UPGRADE and SELL action buttons alongside each other.
   */
  private selectTower(slot: TowerSlot, record: TowerRecord): void {
    if (this.selectedSlotIndex === slot.slotIndex) {
      this.clearSelection();
      return;
    }

    this.clearSelection();
    this.selectedSlotIndex = slot.slotIndex;

    this.renderTowerSelection(slot, record);
  }

  /**
   * Renders the floating status panel and the upgrade/sell action buttons.
   *
   * @remarks Attackers may inspect a tower's range and type; they never get
   * upgrade/sell controls.
   */
  private renderTowerSelection(slot: TowerSlot, record: TowerRecord): void {
    const towerType = TOWER_TYPES[record.tower.typeId];
    const currentTier = towerType ? tierAt(towerType, record.tower.level) : null;
    const maxLevel = towerType?.tiers.length ?? 1;
    const isMax = record.tower.level >= maxLevel;
    const nextTier = towerType && !isMax ? towerType.tiers[record.tower.level] : null;
    const upgradePrice = towerType ? upgradeCost(towerType, record.tower.level) : null;
    const refund = towerType ? sellRefund(record.tower.invested) : 0;
    const isAttackerInspect = this.role === "attacker";

    // Draw range ellipse (horizontally flat) matching current tier range
    const range = currentTier?.range ?? 0;
    if (range > 0) {
      this.rangeCircle = this.scene.add
        .ellipse(slot.x, slot.y, range * 1.9, range * 1.15, 0x38bdf8, 0.12)
        .setStrokeStyle(2, 0x38bdf8, 0.6) as unknown as Phaser.GameObjects.Arc;
      this.root?.add(this.rangeCircle as Phaser.GameObjects.Arc);
    }

    // Geometry layout: clamp horizontally and anchor above tower
    const clampedX = Phaser.Math.Clamp(slot.x, 160, 1280 - 160);
    const isTopHalf = slot.y < 340;
    const buttonY = isTopHalf ? slot.y + 82 : Math.max(92, slot.y - 82);
    const panelY = isTopHalf ? buttonY + 58 : buttonY - 58;
    const panelW = 290;
    const panelH = 58;

    // --- Status Panel ---
    this.towerInfoPanel = this.scene.add.container(clampedX, panelY);
    this.towerInfoPanel.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.towerInfoPanel);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0f1d, 0.94);
    bg.lineStyle(1.5, isAttackerInspect ? 0x38bdf8 : 0xca8a04, 0.95);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);

    const nameText = this.scene.add
      .text(-panelW / 2 + 12, -14, towerType?.name ?? record.tower.typeId, {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#f8fafc",
      })
      .setOrigin(0, 0.5);

    const tierBadgeText = this.scene.add
      .text(
        panelW / 2 - 12,
        -14,
        isMax ? "TIER MAX" : `TIER ${record.tower.level}/${maxLevel}`,
        {
          fontSize: "12px",
          fontStyle: "bold",
          color: isMax ? "#fbbf24" : "#38bdf8",
        },
      )
      .setOrigin(1, 0.5);

    bg.lineStyle(1, 0x334155, 0.7);
    bg.lineBetween(-panelW / 2 + 12, 0, panelW / 2 - 12, 0);

    const dmgMin = currentTier?.damage ?? 0;
    const dmgMax = currentTier?.damageMax ?? currentTier?.damage ?? 0;
    const dmgLabel = dmgMax > dmgMin ? `${dmgMin}-${dmgMax}` : `${dmgMin}`;
    const damageTypeLabel =
      towerType?.damageType === "mental" ? "Mental" : "Physical";

    let statsText: Phaser.GameObjects.Text;
    if (!isMax && nextTier && currentTier) {
      const ndMin = nextTier.damage ?? 0;
      const ndMax = nextTier.damageMax ?? nextTier.damage ?? 0;
      const ndLabel = ndMax > ndMin ? `${ndMin}-${ndMax}` : `${ndMin}`;
      statsText = this.scene.add
        .text(
          0,
          14,
          `DMG ${dmgLabel}➔${ndLabel} (${damageTypeLabel})   RNG ${currentTier.range}➔${nextTier.range}   SPD ${currentTier.fireRate}➔${nextTier.fireRate}/s`,
          {
            fontSize: "11px",
            fontStyle: "bold",
            color: "#cbd5e1",
          },
        )
        .setOrigin(0.5, 0.5);
    } else if (currentTier) {
      statsText = this.scene.add
        .text(
          0,
          14,
          `DMG ${dmgLabel} (${damageTypeLabel})   RNG ${currentTier.range}   SPD ${currentTier.fireRate}/s`,
          {
            fontSize: "11px",
            fontStyle: "bold",
            color: "#94a3b8",
          },
        )
        .setOrigin(0.5, 0.5);
    } else {
      statsText = this.scene.add
        .text(0, 14, "NO STATS", {
          fontSize: "12px",
          color: "#94a3b8",
        })
        .setOrigin(0.5, 0.5);
    }

    this.towerInfoPanel.add([bg, nameText, tierBadgeText, statsText]);

    this.towerInfoPanel.add([bg, nameText, tierBadgeText, statsText]);

    if (isAttackerInspect) {
      // Attackers can inspect towers but not upgrade or sell them.
      const panelBg = this.towerInfoPanel.list[0] as Phaser.GameObjects.Graphics;
      const panelName = this.towerInfoPanel.list[1] as Phaser.GameObjects.Text;
      const panelBadge = this.towerInfoPanel.list[2] as Phaser.GameObjects.Text;
      panelBg.clear();
      panelBg.fillStyle(0x0a0f1d, 0.95);
      panelBg.lineStyle(1.8, 0x38bdf8, 0.95);
      const pw = Math.max(panelW + 60, 300);
      const ph = panelH + 70;
      panelBg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
      panelBg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
      panelBg.lineStyle(1, 0x334155, 0.7);
      panelBg.lineBetween(-pw / 2 + 14, -14, pw / 2 - 14, -14);
      panelName.setFontSize(16);
      panelName.setX(-pw / 2 + 14);
      panelName.setY(-ph / 2 + 20);
      panelName.setFontFamily("Arial, sans-serif");
      panelName.setFontStyle("normal");
      panelName.setColor("#f8fafc");
      if (panelBadge) panelBadge.destroy();
      if (this.towerInfoPanel.list[3]) {
        this.towerInfoPanel.remove(this.towerInfoPanel.list[3], true);
      }
    if (isAttackerInspect) {
      // Attackers can inspect towers but not upgrade or sell them.
      const panelBg = this.towerInfoPanel.list[0] as Phaser.GameObjects.Graphics;
      const panelName = this.towerInfoPanel.list[1] as Phaser.GameObjects.Text;
      const panelBadge = this.towerInfoPanel.list[2] as Phaser.GameObjects.Text;
      panelBg.clear();
      panelBg.fillStyle(0x0a0f1d, 0.95);
      panelBg.lineStyle(1.8, 0x38bdf8, 0.95);
      const pw = Math.max(panelW + 60, 300);
      const ph = panelH + 70;
      panelBg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
      panelBg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
      panelBg.lineStyle(1, 0x334155, 0.7);
      panelBg.lineBetween(-pw / 2 + 14, -14, pw / 2 - 14, -14);
      panelName.setFontSize(16);
      panelName.setX(-pw / 2 + 14);
      panelName.setY(-ph / 2 + 20);
      panelName.setFontFamily("Arial, sans-serif");
      panelName.setFontStyle("normal");
      panelName.setColor("#f8fafc");
      if (panelBadge) panelBadge.destroy();
      if (this.towerInfoPanel.list[3]) {
        this.towerInfoPanel.remove(this.towerInfoPanel.list[3], true);
      }
      const tierLabel = isMax ? "TIER MAX" : `TIER ${record.tower.level}/${maxLevel}`;
      const nameLine = `${towerType?.name ?? record.tower.typeId} • ${damageTypeLabel}`;
      const inspectStats = this.scene.add
        .text(
          -pw / 2 + 14,
          14,
          `${nameLine}\nDMG: ${dmgLabel}   RNG: ${currentTier?.range ?? 0}\nSPD: ${currentTier?.fireRate ?? 0}/s   ${tierLabel}`,
          {
            fontSize: "14px",
            fontFamily: "Arial, sans-serif",
            fontStyle: "normal",
            color: "#e2e8f0",
            lineSpacing: 10,
            wordWrap: { width: pw - 28, useAdvancedWrap: true },
          },
        )
        .setOrigin(0, 0.5);
      this.towerInfoPanel.add(inspectStats);
      return;
    }

    // --- Action Buttons (UPGRADE on left, SELL on right) ---
    const btnWidth = 116;
    const btnHeight = btnWidth / UI_ASPECT.button;

    // Upgrade Button
    if (!isMax && upgradePrice !== null) {
      const canAfford = this.gold >= upgradePrice;
      this.upgradeButton = new UIButton({
        scene: this.scene,
        x: clampedX - 63,
        y: buttonY,
        width: btnWidth,
        height: btnHeight,
        label: `UPG -${upgradePrice}g`,
        fontSize: 13,
        labelColor: canAfford ? "#ffffff" : "#94a3b8",
        onClick: () => {
          this.requestUpgrade(record);
        },
      });
      if (!canAfford) {
        this.upgradeButton.setEnabled(false);
      }
    } else {
      this.upgradeButton = new UIButton({
        scene: this.scene,
        x: clampedX - 63,
        y: buttonY,
        width: btnWidth,
        height: btnHeight,
        label: "MAX TIER",
        fontSize: 12,
        labelColor: "#94a3b8",
        onClick: () => {},
      });
      this.upgradeButton.setEnabled(false);
    }
    this.upgradeButton.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.upgradeButton.container);

    // Sell Button
    this.sellButton = new UIButton({
      scene: this.scene,
      x: clampedX + 63,
      y: buttonY,
      width: btnWidth,
      height: btnHeight,
      label: `SELL +${refund}g`,
      fontSize: 13,
      labelColor: "#ffffff",
      onClick: () => {
        this.requestSell(record);
      },
    });
    this.sellButton.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.sellButton.container);
  }

  /**
   * Arms a pending upgrade confirmation on the upgrade button.
   */
  private requestUpgrade(record: TowerRecord): void {
    if (!this.upgradeButton) return;
    this.resetSellButton(record);

    this.upgradeButton.setLabel("✓ UPGRADE");
    this.upgradeButton.setLabelColor("#4ade80");
    this.upgradeButton.setFontSize(14);
    this.upgradeButton.setOnClick(() => this.confirmUpgrade(record));
  }

  /** Sends the upgrade request to the server. */
  private confirmUpgrade(record: TowerRecord): void {
    this.room.send(MESSAGES.upgradeTower, { towerId: record.id });
    if (this.upgradeButton) {
      this.upgradeButton.setEnabled(false);
      this.upgradeButton.setLabel("UPGRADING...");
      this.upgradeButton.setLabelColor("#94a3b8");
    }
  }

  /** Resets the upgrade button to its unconfirmed state. */
  private resetUpgradeButton(record: TowerRecord): void {
    if (!this.upgradeButton) return;
    const towerType = TOWER_TYPES[record.tower.typeId];
    const isMax = towerType ? record.tower.level >= towerType.tiers.length : true;
    const upgradePrice = towerType ? upgradeCost(towerType, record.tower.level) : null;
    if (!isMax && upgradePrice !== null) {
      const canAfford = this.gold >= upgradePrice;
      this.upgradeButton.setLabel(`UPG -${upgradePrice}g`);
      this.upgradeButton.setLabelColor(canAfford ? "#ffffff" : "#94a3b8");
      this.upgradeButton.setFontSize(13);
      this.upgradeButton.setEnabled(canAfford);
      this.upgradeButton.setOnClick(() => {
        this.requestUpgrade(record);
      });
    } else {
      this.upgradeButton.setLabel("MAX TIER");
      this.upgradeButton.setLabelColor("#94a3b8");
      this.upgradeButton.setFontSize(12);
      this.upgradeButton.setEnabled(false);
    }
  }

  /**
   * Creates the floating action button above a slot (used by build confirmation).
   */
  private createActionButton(
    slot: TowerSlot,
    label: string,
    confirm: boolean,
    onClick: () => void,
  ): UIButton {
    const buttonWidth = 130;

    const button = new UIButton({
      scene: this.scene,
      x: Phaser.Math.Clamp(slot.x, 80, 1200),
      y: slot.y < 280 ? slot.y + 75 : slot.y - 75,
      width: buttonWidth,
      height: buttonWidth / UI_ASPECT.button,
      label,
      fontSize: confirm ? 16 : 14,
      labelColor: confirm ? "#4ade80" : "#ffffff",
      onClick: () => {
        onClick();
      },
    });
    button.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(button.container);

    return button;
  }

  /** Turns the sell button into a tick awaiting a second click to confirm. */
  private requestSell(record: TowerRecord): void {
    if (!this.sellButton) return;
    this.resetUpgradeButton(record);

    this.sellButton.setLabel("✓ SELL");
    this.sellButton.setLabelColor("#4ade80");
    this.sellButton.setFontSize(14);
    this.sellButton.setOnClick(() => this.confirmSell(record));
  }

  /** Sends the sale once the defender confirms it with the tick. */
  private confirmSell(record: TowerRecord): void {
    this.room.send(MESSAGES.sellTower, { towerId: record.id });
    this.clearSelection();
  }

  /** Resets the sell button to its unconfirmed state. */
  private resetSellButton(record: TowerRecord): void {
    if (!this.sellButton) return;
    const towerType = TOWER_TYPES[record.tower.typeId];
    const refund = towerType ? sellRefund(record.tower.invested) : 0;
    this.sellButton.setLabel(`SELL +${refund}g`);
    this.sellButton.setLabelColor("#ffffff");
    this.sellButton.setFontSize(13);
    this.sellButton.setOnClick(() => {
      this.requestSell(record);
    });
  }

  /**
   * Refreshes the currently active selection UI (e.g. after an upgrade or gold change).
   */
  private refreshTowerSelection(slot: TowerSlot, record: TowerRecord): void {
    if (this.selectedSlotIndex !== slot.slotIndex) return;
    this.rangeCircle?.destroy();
    this.rangeCircle = undefined;
    this.upgradeButton?.destroy();
    this.upgradeButton = undefined;
    this.sellButton?.destroy();
    this.sellButton = undefined;
    this.towerInfoPanel?.destroy();
    this.towerInfoPanel = undefined;

    this.renderTowerSelection(slot, record);
  }

  /**
   * Clears the selected tower, its range, and any pending build or sale/upgrade.
   */
  private clearSelection(): void {
    this.selectedSlotIndex = undefined;
    this.pendingBuild = undefined;
    this.rangeCircle?.destroy();
    this.rangeCircle = undefined;
    this.buildHighlight?.destroy();
    this.buildHighlight = undefined;
    this.actionButton?.destroy();
    this.actionButton = undefined;
    this.upgradeButton?.destroy();
    this.upgradeButton = undefined;
    this.sellButton?.destroy();
    this.sellButton = undefined;
    this.towerInfoPanel?.destroy();
    this.towerInfoPanel = undefined;
  }

  private renderPhaseBanner(): void {
    const bannerX = 640;
    const bannerY = 108;
    const bannerWidth = 360;
    const bannerHeight = bannerWidth / UI_BG_ASPECT.notification1;

    const bannerText =
      this.role === "defender"
        ? "BUILDING PHASE — Place Your Towers"
        : "BUILDING PHASE — Defender is setting up defenses";

    this.phaseBanner = this.scene.add.container(bannerX, bannerY);

    const bg = this.scene.add
      .image(0, 0, UI_BG_TEXTURE_KEY, UI_BG_FRAMES.notification1)
      .setDisplaySize(bannerWidth, bannerHeight);

    const text = this.scene.add
      .text(0, 4, bannerText, {
        fontSize: "14px",
        color: "#3a2412",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: bannerWidth * 0.72 },
      })
      .setOrigin(0.5);

    this.phaseBanner.add([bg, text]);
    this.phaseBanner.setDepth(DEPTH.UI_LAYER);
    this.uiRoot?.add(this.phaseBanner);
  }


  /**
   * Mirrors `RoomState.towers` into sprites for both players using Colyseus Callbacks.
   */
  private setupTowerSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown, key: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (slot) {
        this.renderTower(slot, tower, String(key));

        this.unsubscribers.push(
          callbacks.listen(tower, "level", () => {
            const record = this.towers.get(slot.slotIndex);
            if (record) {
              this.updateTowerLevelBadge(record);
              if (this.selectedSlotIndex === slot.slotIndex) {
                this.refreshTowerSelection(slot, record);
              }
            }
          }),
        );
        this.unsubscribers.push(
          callbacks.listen(tower, "invested", () => {
            const record = this.towers.get(slot.slotIndex);
            if (record && this.selectedSlotIndex === slot.slotIndex) {
              this.refreshTowerSelection(slot, record);
            }
          }),
        );
      }
    };

    const onChange = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!slot) return;
      const record = this.towers.get(slot.slotIndex);
      if (record) {
        record.tower = tower;
        this.updateTowerLevelBadge(record);
        if (this.selectedSlotIndex === slot.slotIndex) {
          this.refreshTowerSelection(slot, record);
        }
      }
    };

    const onRemove = (value: unknown): void => {
      const tower = value as Tower;
      const slot = this.map.slots.find((s) => s.slotIndex === tower.slotIndex);
      if (!slot) return;
      const record = this.towers.get(slot.slotIndex);
      record?.sprite.destroy();
      record?.levelBadge?.destroy();
      this.towers.delete(slot.slotIndex);
      if (this.selectedSlotIndex === slot.slotIndex) {
        this.clearSelection();
      }
    };

    // Third parameter `true` immediately calls onAdd for all existing towers in state
    this.unsubscribers.push(callbacks.onAdd("towers", onAdd, true));
    this.unsubscribers.push(callbacks.onChange("towers", onChange));
    this.unsubscribers.push(callbacks.onRemove("towers", onRemove));
  }

  private createTowerLevelBadge(slot: TowerSlot, level: number): Phaser.GameObjects.Container {
    const badge = this.scene.add.container(slot.x, slot.y - 116);
    badge.setDepth(actorDepth(slot.y) + 0.0002);

    const w = 44;
    const h = 18;
    const bg = this.scene.add.graphics();
    bg.name = "bg";
    this.drawBadgeBg(bg, level, w, h);

    const label = this.scene.add
      .text(0, 0, `Lv.${level}`, {
        fontSize: "11px",
        fontStyle: "bold",
        color: level > 1 ? "#fbbf24" : "#e2e8f0",
      })
      .setOrigin(0.5);
    label.name = "label";

    badge.add([bg, label]);
    return badge;
  }

  private drawBadgeBg(bg: Phaser.GameObjects.Graphics, level: number, w: number, h: number): void {
    bg.clear();
    bg.fillStyle(0x090d16, 0.88);
    bg.lineStyle(1.2, level > 1 ? 0xf59e0b : 0x475569, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  }

  private updateTowerLevelBadge(record: TowerRecord): void {
    if (!record.levelBadge) return;
    const label = record.levelBadge.getByName("label") as Phaser.GameObjects.Text | null;
    const bg = record.levelBadge.getByName("bg") as Phaser.GameObjects.Graphics | null;
    if (label) {
      label.setText(`Lv.${record.tower.level}`);
      label.setColor(record.tower.level > 1 ? "#fbbf24" : "#e2e8f0");
    }
    if (bg) {
      this.drawBadgeBg(bg, record.tower.level, 44, 18);
    }
    this.scene.tweens.add({
      targets: record.levelBadge,
      scaleX: 1.25,
      scaleY: 1.25,
      yoyo: true,
      duration: 120,
    });
  }

  private renderTower(slot: TowerSlot, tower: Tower, id: string): void {
    if (this.towers.has(slot.slotIndex)) return;

    const design = getTowerDesign(tower.typeId);

    const sprite = this.scene.add
      .sprite(slot.x, slot.y, design.textureKey)
      .setOrigin(design.origin.x, design.origin.y)
      .setDisplaySize(design.displaySize.width, design.displaySize.height)
      .setDepth(actorDepth(slot.y));

    const levelBadge = this.createTowerLevelBadge(slot, tower.level);

    sprite.setInteractive({ useHandCursor: true });
    sprite.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event?.stopPropagation();
        const record = this.towers.get(slot.slotIndex);
        if (record) this.selectTower(slot, record);
      },
    );

    this.towers.set(slot.slotIndex, { id, tower, sprite, levelBadge });
    // Towers sort against mobs every frame; see `onSceneUpdate`.
    (this.actors ?? this.root)?.add(sprite);
    if (levelBadge) (this.actors ?? this.root)?.add(levelBadge);
  }

  startCombat(): void {
    if (this.combatStarted || this.destroyed) return;
    this.combatStarted = true;

    this.phaseBanner?.destroy();
    this.phaseBanner = undefined;
    this.startButton?.destroy();
    this.startButton = undefined;

    // Show combat alert banner fixed to camera screen space
    const bannerWidth = 400;
    const bannerHeight = bannerWidth / UI_BG_ASPECT.notification2;
    this.combatBanner = this.scene.add.container(640, 45).setScrollFactor(0);
    const bg = this.scene.add
      .image(0, 0, UI_BG_TEXTURE_KEY, UI_BG_FRAMES.notification2)
      .setDisplaySize(bannerWidth, bannerHeight);
    const txt = this.scene.add
      .text(0, 4, "⚔️ COMBAT PHASE — Units Advancing!", {
        fontSize: "14px",
        color: "#f8fafc",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: bannerWidth * 0.72 },
      })
      .setOrigin(0.5);
    this.combatBanner.add([bg, txt]);
    this.combatBanner.setDepth(DEPTH.UI_LAYER);

    this.scene.time.delayedCall(4000, () => {
      this.combatBanner?.destroy();
      this.combatBanner = undefined;
    });
  }

  /**
   * Mirrors `RoomState.mobs` into sprites using Colyseus Callbacks.
   *
   * @remarks Positions are not synced; each frame the sprite is placed from the
   * mob's authoritative `progress` via {@link updateMobSprite}, so the server
   * stays the single source of truth for movement.
   */
  private setupMobSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown, key: unknown): void => {
      const mob = value as Mob;
      const sprite = UnitAnimationManager.spawnMobSprite(this.scene, mob.typeId)
        .setDepth(DEPTH.ACTORS_LAYER);

      // Classic green-on-red bar; the green fill shrinks from its left edge.
      const hpBg = this.scene.add
        .rectangle(0, 0, MOB_HP_BAR.width, MOB_HP_BAR.height, 0x7f1d1d)
        .setOrigin(0.5)
        .setDepth(DEPTH.ACTORS_LAYER + 1);
      const hpFill = this.scene.add
        .rectangle(0, 0, MOB_HP_BAR.width, MOB_HP_BAR.height, 0x22c55e)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.ACTORS_LAYER + 2);

      const record: MobRecord = { id: String(key), x: 0, sprite, hpBg, hpFill };
      this.mobSprites.set(mob, record);
      this.mobsById.set(record.id, record);
      // Same y-sorted layer as towers, so the two occlude by world y.
      (this.actors ?? this.root)?.add([sprite, hpBg, hpFill]);
      this.updateMobSprite(mob, record);
    };

    const onRemove = (value: unknown): void => {
      const record = this.mobSprites.get(value as Mob);
      if (!record) return;
      record.sprite.destroy();
      record.hpBg.destroy();
      record.hpFill.destroy();
      this.mobsById.delete(record.id);
      this.mobSprites.delete(value as Mob);
    };

    // Third parameter `true` immediately renders mobs already present in state.
    this.unsubscribers.push(callbacks.onAdd("mobs", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("mobs", onRemove));
  }

  /** Per-frame pass repositioning every tracked mob sprite and its health bar. */
  private updateMobs(): void {
    if (this.destroyed || this.mobSprites.size === 0) return;
    this.mobSprites.forEach((record, mob) => this.updateMobSprite(mob, record));
  }

  /**
   * Turns each tower to face the mob it is shooting.
   *
   * @remarks Only towers that visibly rotate with their barrel (cannon/bomb)
   * are flipped; fixed emplacements like the archer keep their orientation.
   */
  private updateTowerFacing(): void {
    if (this.destroyed || this.towers.size === 0) return;

    for (const record of this.towers.values()) {
      const design = getTowerDesign(record.tower.typeId);
      if (design.id !== "cannon" && design.id !== "bomb") continue;

      const targetId = record.tower.targetId;
      if (!targetId) continue;

      const target = this.mobsById.get(targetId);
      if (!target) continue;

      const dx = target.x - record.sprite.x;
      if (Math.abs(dx) > 0.5) record.sprite.setFlipX(dx < 0);
    }
  }

  /**
   * Tint that shows a mob's status at a glance.
   *
   * @remarks A slowed mob reads cold blue, a mob whose resolve was cracked by
   * mental damage reads violet, and an untouched mob keeps its natural colors.
   */
  private mobEffectTint(mob: Mob): number {
    if (mob.effects.has(EFFECT_TYPES.slow)) return 0x93c5fd;
    if (mob.effects.has(EFFECT_TYPES.debuff)) return 0xd8b4fe;
    return 0xffffff;
  }

  /**
   * Places one mob (body + health bar) at the path position for its progress.
   */
  private updateMobSprite(mob: Mob, record: MobRecord): void {
    const path = this.pathFor(mob.pathId);
    if (!path || path.length < 2) return;

    const halfWidth = this.map.pathHalfWidth ?? 0;
    const point = samplePathWithLateral(path, mob.progress, mob.seed, halfWidth);

    record.sprite.setPosition(point.x, point.y);
    record.sprite.setDepth(actorDepth(point.y));
    record.x = point.x;

    // Status tint: a slowed mob reads cold blue, a cracked one violet.
    record.sprite.setTint(this.mobEffectTint(mob));

    // Face the direction of travel (art is a side-view sprite, so flip, not rotate).
    const ahead = samplePath(path, Math.min(1, mob.progress + 0.02));
    const dx = ahead.x - point.x;
    if (Math.abs(dx) > 0.5) record.sprite.setFlipX(dx < 0);

    this.updateMobHealthBar(mob, record, point.x, point.y);
  }

  /**
   * Redraws a mob's health bar above it.
   *
   * @remarks The bar is hidden at full health (classic look, less clutter) and
   * scaled so the green fill tracks `hp / maxHp` from the left edge.
   */
  private updateMobHealthBar(
    mob: Mob,
    record: MobRecord,
    x: number,
    y: number,
  ): void {
    const maxHp = mob.maxHp > 0 ? mob.maxHp : 1;
    const ratio = Phaser.Math.Clamp(mob.hp / maxHp, 0, 1);
    const damaged = ratio < 1;

    const barY = y + MOB_HP_BAR.offsetY;
    // Tied to the mob's own y so the bar sits on it and keeps the same
    // front/back order against towers the mob body has.
    record.hpBg.setPosition(x, barY).setDepth(actorDepth(y) + 0.0002).setVisible(damaged);
    record.hpFill
      .setPosition(x - MOB_HP_BAR.width / 2, barY)
      .setDepth(actorDepth(y) + 0.0003)
      .setDisplaySize(MOB_HP_BAR.width * ratio, MOB_HP_BAR.height)
      .setVisible(damaged);
  }

  /**
   * Mirrors `RoomState.projectiles` into sprites using Colyseus Callbacks.
   *
   * @remarks
   * Unlike mobs, projectiles carry their own synced `x`/`y`; the sprite is only
   * re-pointed each frame (see {@link updateProjectiles}) so travel stays smooth
   * between server patches.
   */
  private setupProjectileSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);

    const onAdd = (value: unknown): void => {
      const projectile = value as Projectile;
      const design = getTowerDesign(projectile.typeId);
      const textureKey = this.scene.textures.exists(design.projectileKey)
        ? design.projectileKey
        : "arrow_proj";

      const sprite = this.scene.add
        .sprite(projectile.x, projectile.y, textureKey)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(28, 28)
        .setDepth(DEPTH.PROJECTILES_LAYER);

      this.projectileSprites.set(projectile, sprite);
      this.root?.add(sprite);
    };

    const onRemove = (value: unknown): void => {
      const sprite = this.projectileSprites.get(value as Projectile);
      if (!sprite) return;
      sprite.destroy();
      this.projectileSprites.delete(value as Projectile);
    };

    // Third parameter `true` immediately renders projectiles already in state.
    this.unsubscribers.push(callbacks.onAdd("projectiles", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("projectiles", onRemove));
  }

  /** Per-frame pass moving each projectile sprite to its synced position. */
  private updateProjectiles(): void {
    if (this.destroyed || this.projectileSprites.size === 0) return;

    this.projectileSprites.forEach((sprite, projectile) => {
      const dx = projectile.x - sprite.x;
      const dy = projectile.y - sprite.y;
      if (dx * dx + dy * dy > 0.01) sprite.setRotation(Math.atan2(dy, dx));
      sprite.setPosition(projectile.x, projectile.y);
    });
  }

  /**
   * Keeps the base's floating HP bar in sync with the defender's core.
   *
   * @remarks `coreHp` is authoritative; the bar just reflects it. The max comes
   * from {@link MATCH_RULES} since it never changes mid-match.
   */
  private setupBaseHpSync(): void {
    if (!this.room) return;

    const callbacks = Callbacks.get(this.room);
    this.unsubscribers.push(
      callbacks.listen("coreHp", (value: number) => this.updateBaseHp(value), true),
    );
  }

  /** Redraws the base HP bar (width + colour) and its label. */
  private updateBaseHp(coreHp: number): void {
    const max = MATCH_RULES.coreHp;
    const ratio = max > 0 ? Phaser.Math.Clamp(coreHp / max, 0, 1) : 0;

    this.baseHpFill?.setDisplaySize(this.baseHpBarWidth * ratio, 10);
    this.baseHpFill?.setFillStyle(
      ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444,
    );
    this.baseHpText?.setText(`BASE CASTLE: ${coreHp}/${max} HP`);
  }

  /** Resolves a mob's `pathId` against the map's tracks. */
  private pathFor(pathId: string): Vec2[] | undefined {
    return mapPath(this.map, pathId);
  }

  /**
   * Clamps camera scroll position so visible bounds remain within the 1280x720 map.
   */
  private clampCameraScroll(): void {
    const cam = this.scene.cameras.main;
    const halfW = (cam.width / 2) / cam.zoom;
    const halfH = (cam.height / 2) / cam.zoom;

    const minX = Math.min(0, halfW - cam.width / 2);
    const maxX = Math.max(0, 1280 - halfW - cam.width / 2);
    const minY = Math.min(0, halfH - cam.height / 2);
    const maxY = Math.max(0, 720 - halfH - cam.height / 2);

    if (minX <= maxX) {
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, minX, maxX);
    } else {
      cam.scrollX = 0;
    }

    if (minY <= maxY) {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, minY, maxY);
    } else {
      cam.scrollY = 0;
    }
  }

  /**
   * Initializes drag & pan camera controls with pinch-to-zoom, boundary clamping, and momentum friction.
   *
   * @remarks The pan is driven by the primary mouse button (or a finger): press
   * and drag to move the camera, and the map follows the pointer. A short
   * movement threshold separates a tap from a drag, so clicking a tower still
   * selects it instead of nudging the camera.
   */
  private setupCameraControls(): void {
    const cam = this.scene.cameras.main;
    this.scene.input.addPointer(2);

    this.onCameraPointerDown = (pointer: Phaser.Input.Pointer) => {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      // Two fingers down: initiate pinch-to-zoom gesture
      if (p1.isDown && p2.isDown) {
        this.isPinching = true;
        this.isDragging = false;
        this.dragActive = false;
        this.initialPinchDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.initialZoom = cam.zoom;
        this.cameraVelocityX = 0;
        this.cameraVelocityY = 0;
        return;
      }

      // Only the primary button pans the camera.
      if (!pointer.primaryDown) return;

      this.isDragging = true;
      this.dragActive = false;
      this.dragOriginX = pointer.x;
      this.dragOriginY = pointer.y;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      this.cameraVelocityX = 0;
      this.cameraVelocityY = 0;
    };

    this.onCameraPointerMove = (pointer: Phaser.Input.Pointer) => {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      // Handle two-finger pinch-to-zoom
      if (p1.isDown && p2.isDown) {
        if (!this.isPinching) {
          // The pinch can start without a pointerdown event (a finger landing on
          // a tower cancels it), so seed the gesture here instead.
          this.isPinching = true;
          this.isDragging = false;
          this.dragActive = false;
          this.initialPinchDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
          this.initialZoom = cam.zoom;
          this.cameraVelocityX = 0;
          this.cameraVelocityY = 0;
        }
        const currentDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.initialPinchDistance > 10) {
          const factor = currentDist / this.initialPinchDistance;
          const targetZoom = Phaser.Math.Clamp(this.initialZoom * factor, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
          cam.setZoom(targetZoom);
          this.clampCameraScroll();
        }
        return;
      }

      // A drag can start on a tower or a slot too: those objects cancel the
      // scene's pointerdown event, so the press is picked up from the pointer's
      // own state here.
      if (!this.isDragging) {
        if (!pointer.isDown || !pointer.primaryDown) return;
        this.isDragging = true;
        this.dragActive = false;
        this.dragOriginX = pointer.x;
        this.dragOriginY = pointer.y;
        this.lastPointerX = pointer.x;
        this.lastPointerY = pointer.y;
        this.cameraVelocityX = 0;
        this.cameraVelocityY = 0;
      }

      if (this.isPinching || !pointer.isDown) return;

      // A tap must stay a tap: the camera only starts panning once the pointer
      // has travelled past the threshold.
      if (!this.dragActive) {
        const travelX = pointer.x - this.dragOriginX;
        const travelY = pointer.y - this.dragOriginY;
        if (Math.hypot(travelX, travelY) < CAMERA_DRAG_THRESHOLD) {
          this.lastPointerX = pointer.x;
          this.lastPointerY = pointer.y;
          return;
        }
        this.dragActive = true;
        this.lastPointerX = pointer.x;
        this.lastPointerY = pointer.y;
        return;
      }

      const dx = pointer.x - this.lastPointerX;
      const dy = pointer.y - this.lastPointerY;

      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      this.clampCameraScroll();

      this.cameraVelocityX = -dx / cam.zoom;
      this.cameraVelocityY = -dy / cam.zoom;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
    };

    this.onCameraPointerUp = () => {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      if (!p1.isDown || !p2.isDown) {
        this.isPinching = false;
        this.initialPinchDistance = 0;
      }

      this.isDragging = false;
      this.dragActive = false;
    };

    this.onCameraWheel = (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
      cam.setZoom(newZoom);
      this.clampCameraScroll();
    };

    this.scene.input.on("pointerdown", this.onCameraPointerDown);
    this.scene.input.on("pointermove", this.onCameraPointerMove);
    this.scene.input.on("pointerup", this.onCameraPointerUp);
    this.scene.input.on("wheel", this.onCameraWheel);
  }

  /**
   * Per-frame update for camera glide physics (friction: 0.1 decay).
   */
  update(_time: number, _delta: number): void {
    // The pointer can be released without a pointerup event reaching the scene
    // (a tower cancels it), so the drag is also closed from the pointer state.
    if (this.isDragging && !this.scene.input.pointer1.isDown) {
      this.isDragging = false;
      this.dragActive = false;
    }

    if (!this.isDragging && !this.isPinching && (Math.abs(this.cameraVelocityX) > 0.05 || Math.abs(this.cameraVelocityY) > 0.05)) {
      const cam = this.scene.cameras.main;
      cam.scrollX += this.cameraVelocityX;
      cam.scrollY += this.cameraVelocityY;
      this.clampCameraScroll();
      this.cameraVelocityX *= 0.9; // friction 0.1 decay factor
      this.cameraVelocityY *= 0.9;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.combatStarted = false;

    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);

    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];

    for (const record of this.mobSprites.values()) {
      record.sprite.destroy();
      record.hpBg.destroy();
      record.hpFill.destroy();
    }
    this.mobSprites.clear();
    this.mobsById.clear();

    for (const sprite of this.projectileSprites.values()) sprite.destroy();
    this.projectileSprites.clear();

    if (this.onKeyDown) {
      this.scene.input.keyboard?.off("keydown-D", this.onKeyDown);
    }
    if (this.onPointerDown) {
      this.scene.input.off("pointerdown", this.onPointerDown);
    }
    this.onKeyDown = undefined;
    this.onPointerDown = undefined;

    if (this.onCameraPointerDown) {
      this.scene.input.off("pointerdown", this.onCameraPointerDown);
    }
    if (this.onCameraPointerMove) {
      this.scene.input.off("pointermove", this.onCameraPointerMove);
    }
    if (this.onCameraPointerUp) {
      this.scene.input.off("pointerup", this.onCameraPointerUp);
    }
    if (this.onCameraWheel) {
      this.scene.input.off("wheel", this.onCameraWheel);
    }
    this.onCameraPointerDown = undefined;
    this.onCameraPointerMove = undefined;
    this.onCameraPointerUp = undefined;
    this.onCameraWheel = undefined;

    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;

    this.clearSelection();

    // Portal sprites/pips/glow are children of `root`, destroyed with it.
    this.portals.clear();
    this.phaseBanner?.destroy();
    this.startButton?.destroy();
    this.goldFrame = undefined;
    this.goldText = undefined;
    this.baseHpFill = undefined;
    this.baseHpText = undefined;

    for (const obj of this.deckObjects) obj.destroy();
    this.deckObjects = [];
    this.combatBanner?.destroy();
    this.combatBanner = undefined;

    this.ambientNpcManager?.destroy();
    this.ambientNpcManager = undefined;

    this.uiRoot?.destroy(true);
    this.uiRoot = undefined;

    this.root?.destroy(true);
    this.root = undefined;

    this.towers.clear();
    this.deckCards.clear();
  }
}
