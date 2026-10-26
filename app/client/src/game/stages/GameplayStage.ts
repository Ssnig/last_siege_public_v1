import Phaser from "phaser";
import { Callbacks, Room } from "@colyseus/sdk";
import {
  MESSAGES,
  EFFECT_TYPES,
  TOWER_EFFECT_TYPES,
  samplePath,
  samplePathWithLateral,
  mapPath,
  mapPathIds,
  mapPortals,
  portalShouldFlipX,
  type MapDefinition,
  type Mob,
  type MobAbilityPayload,
  type MobDeathExplosionPayload,
  type GunBountyProcPayload,
  type CombatDamagePayload,
  type Projectile,
  type Tower,
  type TowerAttackPayload,
  type Vec2,
  type YouEconomyPayload,
  type AttackerBufferPayload,
  type TowerTierSpecial,
  TOWER_TYPES,
  MATCH_RULES,
  portalChargeRules,
  sellRefund,
  upgradeCost,
  tierAt,
  getTowerDesign,
  TOWER_AIM_PIVOT_Y_OFFSET,
  PROP_CATALOG,
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
import { TowerAnimationManager } from "../animation/TowerAnimationManager";
import { AmbientNPCManager } from "../npc/AmbientNPCManager";
import { soundEffects } from "../../audio/soundEffects";
import { FloatingCombatTextManager } from "../vfx/FloatingCombatText";

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
const CAMERA_DRAG_THRESHOLD = 10;

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
  stunVfx?: Phaser.GameObjects.Sprite;
  wasStunned?: boolean;
};

/** A mob and the sprites that render it: body plus its health bar. */
type MobRecord = {
  /** Server id of the mob, used to resolve a tower's current target. */
  id: string;
  /** Mob archetype id (e.g. "say_sayar"). */
  typeId: string;
  /** Last computed world x of the mob body. */
  x: number;
  /** Last computed world y of the mob body. */
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  /** Active VFX sprites (e.g. heal aura) riding on this mob. */
  vfxSprites?: Set<Phaser.GameObjects.Sprite>;
  /** Last known physical armor stacks (for Belu adaptive defense VFX). */
  lastArmorStacks?: number;
  /** Last known mental strength stacks (for Belu adaptive defense VFX). */
  lastMentalStacks?: number;
  /** Last known armor crush magnitude (for Sein Pyaung armor strip alert). */
  lastArmorCrush?: number;
  /** Whether the mob is currently silenced (for Chinthe silence alert). */
  wasSilenced?: boolean;
  /** Whether monkey's initial sprint burst has ended upon taking damage. */
  burstBroken?: boolean;
  /** Last sampled progress along path (used to differentiate death vs base breach). */
  lastProgress?: number;
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
  private towerLastCooldown: Map<number, number> = new Map();
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

  private baseSprite?: Phaser.GameObjects.Sprite;
  private baseHpFill?: Phaser.GameObjects.Rectangle;
  private baseHpText?: Phaser.GameObjects.Text;
  private baseHpBarWidth = 120;
  private lastCoreHp?: number;
  private lastBreachVfxTime = 0;

  private selectedSlotIndex?: number;
  private rangeCircle?: Phaser.GameObjects.Arc;
  private selectionHalo?: Phaser.GameObjects.Arc;
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
  private dragActive = false;
  private lastDragEndTime = 0;
  private dragOriginX = 0;
  private dragOriginY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPointerTime = 0;
  private cameraVelocityX = 0;
  private cameraVelocityY = 0;

  // Multi-touch Pinch Tracking
  private lastPinchDistance = 0;
  private lastPinchMidX = 0;
  private lastPinchMidY = 0;

  private onCameraPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onCameraPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onCameraPointerUp?: (pointer: Phaser.Input.Pointer) => void;
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

  public setRole(role: "attacker" | "defender"): void {
    this.role = role;
  }

  public get effectiveRole(): "attacker" | "defender" {
    const authoritative = this.room?.state?.players?.get(this.room?.sessionId)?.role as
      | "attacker"
      | "defender"
      | undefined;
    if (authoritative === "attacker" || authoritative === "defender") {
      return authoritative;
    }
    return this.role;
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

    if (this.effectiveRole === "defender") {
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
      const flipX = portalShouldFlipX(this.map, portal);
      const sprite = this.scene.add
        .sprite(portal.x, portal.y, "spawn_2")
        .setOrigin(0.5, 0.72)
        .setDisplaySize(130, 130)
        .setDepth(DEPTH.PORTAL_LAYER + portal.y * 0.001)
        .setFlipX(flipX)
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
      if (this.effectiveRole === "attacker") {
        const hit = this.scene.add
          .circle(portal.x, portal.y - 20, 52, 0xffffff, 0)
          .setDepth(DEPTH.PORTAL_LAYER + 0.004)
          .setInteractive({ useHandCursor: true });
        let portalDownX = 0;
        let portalDownY = 0;
        hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          portalDownX = pointer.x;
          portalDownY = pointer.y;
        });
        hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          const dist = Math.hypot(pointer.x - portalDownX, pointer.y - portalDownY);
          if (dist < 12 && !this.wasRecentlyDragged()) {
            this.room.send(MESSAGES.deploy, { portalId: portal.id });
          }
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
      const isLocked = !!status?.locked;
      const charges = isLocked ? 0 : (status?.charges ?? 0);

      record.sprite.setAlpha(isLocked ? 0.4 : 1);
      record.glow.setVisible(!isLocked && charges > 0);
      record.pips.forEach((pip, index) => {
        pip.setVisible(!!status && !isLocked);
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
      if (this.attackerBuffer?.portals.some((p) => p.id === id && p.locked)) continue;
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
    if (this.effectiveRole === "defender") {
      const zoneWidth = this.map.width || 1280;
      const zoneHeight = this.map.height || 720;
      const deselectZone = this.scene.add
        .zone(0, 0, zoneWidth, zoneHeight)
        .setOrigin(0, 0)
        .setInteractive(
          new Phaser.Geom.Rectangle(0, 0, zoneWidth, zoneHeight),
          Phaser.Geom.Rectangle.Contains,
        );
      let deselectDownX = 0;
      let deselectDownY = 0;
      deselectZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        deselectDownX = pointer.x;
        deselectDownY = pointer.y;
      });
      deselectZone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        const dist = Math.hypot(pointer.x - deselectDownX, pointer.y - deselectDownY);
        if (dist < 12 && !this.wasRecentlyDragged()) {
          this.clearSelection();
        }
      });
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
    // Spawn 2.5D isometric atmospheric scenery props authored on the map
    if (this.map.props && this.map.props.length > 0) {
      for (const prop of this.map.props) {
        const def = PROP_CATALOG[prop.typeId];
        const textureKey = `prop_${prop.typeId}`;
        if (this.scene.textures.exists(textureKey)) {
          const scale = (prop.scale ?? 1.0) * (def?.defaultScale ?? 1.0);
          const anchorY = def?.anchorY ?? 0.9;
          const sprite = this.scene.add
            .sprite(prop.x, prop.y, textureKey)
            .setOrigin(0.5, anchorY)
            .setScale(scale)
            .setDepth(actorDepth(prop.y));

          if (prop.flipX) sprite.setFlipX(true);

          if (def?.category === "npcs") {
            this.scene.tweens.add({
              targets: sprite,
              y: prop.y - 2,
              duration: 1200 + Math.random() * 500,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }

          (this.actors ?? this.root)?.add(sprite);
        }
      }
    }


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

    // Render interactive tower slots with authentic Burmese lotus stone dais
    const holderScale = this.map.holderScale ?? 1.0;
    this.map.slots.forEach((slot) => {
      // 1. High-fidelity stone foundation dais
      const baseSprite = this.scene.textures.exists("tower_placeholder_1")
        ? this.scene.add
            .image(slot.x, slot.y, "tower_placeholder_1")
            .setDisplaySize(65 * holderScale, 50 * holderScale)
            .setDepth(DEPTH.SLOTS_LAYER)
            .setName("tower-slot-base")
        : null;
      if (baseSprite) this.root?.add(baseSprite);

      // 2. Interactive hit area
      const placeholder = this.scene.add
        .circle(slot.x, slot.y, 30 * holderScale, 0x000000, 0.001)
        .setDepth(DEPTH.SLOTS_LAYER + 0.01)
        .setName("tower-slot");
      placeholder.setData("slotIndex", slot.slotIndex);

      if (this.effectiveRole === "defender") {
        placeholder.setInteractive({ useHandCursor: true });

        placeholder.on("pointerover", () => {
          this.scene.registry.set("ui:overTowerSlot", true);
          if (!this.towers.has(slot.slotIndex)) {
            baseSprite?.setTint(0xffe082);
            this.showGhostTower(slot);
          }
        });
        placeholder.on("pointerout", () => {
          this.scene.registry.set("ui:overTowerSlot", false);
          baseSprite?.clearTint();
          this.hideGhostTower();
        });
        let slotDownX = 0;
        let slotDownY = 0;
        placeholder.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          slotDownX = pointer.x;
          slotDownY = pointer.y;
          this.scene.registry.set("ui:overTowerSlot", true);
        });
        placeholder.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          this.scene.registry.set("ui:overTowerSlot", false);
          const dist = Math.hypot(pointer.x - slotDownX, pointer.y - slotDownY);
          if (dist < 12 && !this.wasRecentlyDragged()) {
            this.handleSlotClick(slot);
          }
        });
      } else {
        placeholder.on("pointerover", () => {
          this.scene.registry.set("ui:overTowerSlot", true);
        });
        placeholder.on("pointerout", () => {
          this.scene.registry.set("ui:overTowerSlot", false);
        });
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
      this.baseSprite = baseSprite;
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

    if (this.effectiveRole !== "defender") {
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
    const scale = this.map.holderScale ?? 1.0;
    const sheetKey = `tower_${design.id}_sheet`;
    const ghostTexKey = this.scene.textures.exists(sheetKey) ? sheetKey : design.textureKey;

    this.ghostTower = this.scene.add
      .sprite(slot.x, slot.y, ghostTexKey)
      .setOrigin(design.origin.x, design.origin.y)
      .setDisplaySize(design.displaySize.width * scale, design.displaySize.height * scale)
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
    const upgradePrice = towerType ? upgradeCost(towerType, record.tower.level) : null;
    const refund = towerType ? sellRefund(record.tower.invested) : 0;
    const isAttackerInspect = this.effectiveRole === "attacker";

    // Draw golden range ring matching current tier range
    const range = currentTier?.range ?? 0;
    if (range > 0) {
      this.rangeCircle = this.scene.add
        .circle(slot.x, slot.y, range, 0xfbbf24, 0.1)
        .setStrokeStyle(2, 0xfbbf24, 0.75);
      this.root?.add(this.rangeCircle);
    }

    // Glowing selection halo directly around the active tower base
    this.selectionHalo = this.scene.add
      .circle(slot.x, slot.y, 50, 0xfbbf24, 0.22)
      .setStrokeStyle(2.5, 0xfbbf24, 0.9)
      .setDepth(DEPTH.SLOTS_LAYER + 0.1);
    this.root?.add(this.selectionHalo);

    // Geometry layout: clamp horizontally and anchor above tower
    const clampedX = Phaser.Math.Clamp(slot.x, 175, 1280 - 175);
    const isTopHalf = slot.y < 340;
    const buttonY = isTopHalf ? slot.y + 96 : Math.max(92, slot.y - 96);
    const panelY = isTopHalf ? buttonY + 78 : buttonY - 78;
    const panelW = 290;

    // --- Status Panel ---
    // Both roles see the exact same three-row layout: name + damage type,
    // damage + range, then firing rate + tier. Only the border colour and the
    // action buttons below differ.
    this.towerInfoPanel = this.scene.add.container(clampedX, panelY);
    this.towerInfoPanel.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.towerInfoPanel);

    const specialSummary = this.getTowerSpecialSummary(currentTier?.special);
    const pw = Math.max(panelW, 300);
    const ph = specialSummary ? 116 : 96;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0f1d, 0.95);
    bg.lineStyle(1.8, isAttackerInspect ? 0x38bdf8 : 0xca8a04, 0.95);
    bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    bg.lineStyle(1, 0x334155, 0.7);
    bg.lineBetween(-pw / 2 + 16, -ph / 2 + 42, pw / 2 - 16, -ph / 2 + 42);

    const dmgMin = currentTier?.damage ?? 0;
    const dmgMax = currentTier?.damageMax ?? currentTier?.damage ?? 0;
    const dmgLabel = dmgMax > dmgMin ? `${dmgMin}-${dmgMax}` : `${dmgMin}`;
    const isMental = towerType?.damageType === "mental";
    const damageTypeLabel = isMental ? "Mental" : "Physical";
    const tierLabel = isMax ? "TIER MAX" : `TIER ${record.tower.level}/${maxLevel}`;

    // Row 1: tower name and the damage-type indicator.
    const nameText = this.scene.add
      .text(
        -pw / 2 + 16,
        -ph / 2 + 22,
        towerType?.name ?? record.tower.typeId,
        {
          fontSize: "16px",
          fontFamily: "Arial, sans-serif",
          fontStyle: "bold",
          color: "#f8fafc",
        },
      )
      .setOrigin(0, 0.5);

    const damageTypeText = this.scene.add
      .text(pw / 2 - 16, -ph / 2 + 22, damageTypeLabel, {
        fontSize: "13px",
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        color: isMental ? "#c084fc" : "#38bdf8",
      })
      .setOrigin(1, 0.5);

    // Row 2: damage and range.
    const dmgRangeText = this.scene.add
      .text(
        -pw / 2 + 16,
        -ph / 2 + 60,
        `DMG: ${dmgLabel}    RNG: ${currentTier?.range ?? 0}`,
        {
          fontSize: "14px",
          fontFamily: "Arial, sans-serif",
          fontStyle: "normal",
          color: "#e2e8f0",
        },
      )
      .setOrigin(0, 0.5);

    // Row 3: firing rate and tier.
    const spdTierText = this.scene.add
      .text(
        -pw / 2 + 16,
        -ph / 2 + 82,
        `SPD: ${currentTier?.fireRate ?? 0}/s    ${tierLabel}`,
        {
          fontSize: "14px",
          fontFamily: "Arial, sans-serif",
          fontStyle: "normal",
          color: isMax ? "#fbbf24" : "#e2e8f0",
        },
      )
      .setOrigin(0, 0.5);

    const elements: Phaser.GameObjects.GameObject[] = [
      bg,
      nameText,
      damageTypeText,
      dmgRangeText,
      spdTierText,
    ];

    if (specialSummary) {
      const specialText = this.scene.add
        .text(-pw / 2 + 16, -ph / 2 + 102, specialSummary, {
          fontSize: "12px",
          fontFamily: "Arial, sans-serif",
          fontStyle: "italic",
          color: "#fde047",
        })
        .setOrigin(0, 0.5);
      elements.push(specialText);
    }

    this.towerInfoPanel.add(elements);

    if (isAttackerInspect) {
      // Attackers can inspect towers but not upgrade or sell them.
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
        label: `🔨 UPG -${upgradePrice}g`,
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
        label: "👑 MAX TIER",
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
      label: `💰 SELL +${refund}g`,
      fontSize: 13,
      labelColor: "#ffffff",
      onClick: () => {
        this.requestSell(record);
      },
    });
    this.sellButton.container.setDepth(DEPTH.UI_LAYER);
    this.root?.add(this.sellButton.container);
  }

  private getTowerSpecialSummary(special?: TowerTierSpecial): string | null {
    if (!special) return null;
    if (special.windupMaxBonus) return `Windup: +10% SPD/shot (max +${Math.round(special.windupMaxBonus * 100)}%)`;
    if (special.armorPierceRatio) return `Armor Pierce: Ignores ${Math.round(special.armorPierceRatio * 100)}% armor`;
    if (special.bleedTotalDamage) return `Bleed: ${special.bleedTotalDamage} dmg over 3s`;
    if (special.pulseSlow) return `Pulse: ${Math.round(special.pulseSlow * 100)}% slow for 1.5s`;
    if (special.prioritizeSupport) return `Bounty Hunter: Targets support, +${special.bonusGoldOnKill}g`;
    if (special.drenchSlow) return `Drench: ${Math.round(special.drenchSlow * 100)}% slow, +${Math.round((special.drenchVulnerability ?? 0) * 100)}% mental vuln`;
    if (special.silenceSec) return `Roar: ${special.knockbackPx}px knockback, ${special.silenceSec}s silence`;
    if (special.deathExplosionDamage) return `Detonation: ${special.deathExplosionDamage} dmg on kill (${special.deathExplosionRadius}px)`;
    if (special.armorStripPermanent) return `Crush: Permanently strips ${special.armorStripPermanent} armor/hit`;
    if (special.knockbackPx) return `Knockback: ${special.knockbackPx}px`;
    return null;
  }

  /**
   * Arms a pending upgrade confirmation on the upgrade button.
   */
  private requestUpgrade(record: TowerRecord): void {
    if (!this.upgradeButton) return;
    this.resetSellButton(record);

    this.upgradeButton.setLabel("✓ CONFIRM");
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
      this.upgradeButton.setLabel(`🔨 UPG -${upgradePrice}g`);
      this.upgradeButton.setLabelColor(canAfford ? "#ffffff" : "#94a3b8");
      this.upgradeButton.setFontSize(13);
      this.upgradeButton.setEnabled(canAfford);
      this.upgradeButton.setOnClick(() => {
        this.requestUpgrade(record);
      });
    } else {
      this.upgradeButton.setLabel("👑 MAX TIER");
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
      y: slot.y < 340 ? slot.y + 75 : slot.y - 75,
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

    this.sellButton.setLabel("⚠️ CONFIRM?");
    this.sellButton.setLabelColor("#ef4444");
    this.sellButton.setFontSize(13);
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
    this.sellButton.setLabel(`💰 SELL +${refund}g`);
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
    this.selectionHalo?.destroy();
    this.selectionHalo = undefined;
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
    this.selectionHalo?.destroy();
    this.selectionHalo = undefined;
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
      this.effectiveRole === "defender"
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

        const record = this.towers.get(slot.slotIndex);
        if (record && tower.effects?.has(TOWER_EFFECT_TYPES.stun)) {
          record.wasStunned = true;
          const vfx = UnitAnimationManager.spawnSoneMaStunLoopVfx(
            this.scene,
            record.sprite.x,
            record.sprite.y,
          );
          if (vfx) {
            vfx.setDepth(record.sprite.depth + 0.0001);
            (this.actors ?? this.root)?.add(vfx);
            record.stunVfx = vfx;
          }
        }

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
      record?.stunVfx?.destroy();
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

    let sprite: Phaser.GameObjects.Sprite;
    if (
      design.id === "archer" ||
      design.id === "bomb" ||
      design.id === "spear" ||
      design.id === "gun" ||
      design.id === "water_cannon" ||
      design.id === "chinthe" ||
      design.id === "dragon" ||
      design.id === "bell" ||
      design.id === "sein_pyaung"
    ) {
      const sheetKey =
        design.id === "archer"
          ? "tower_archer_sheet"
          : design.id === "bomb"
            ? "tower_bomb_sheet"
            : design.id === "spear"
              ? "tower_spear_sheet"
              : design.id === "gun"
                ? "tower_gun_sheet"
                : design.id === "water_cannon"
                  ? "tower_water_cannon_sheet"
                  : design.id === "chinthe"
                    ? "tower_chinthe_sheet"
                    : design.id === "dragon"
                      ? "tower_dragon_sheet"
                      : design.id === "sein_pyaung"
                        ? "tower_sein_pyaung_sheet"
                        : "tower_bell_sheet";
      const idleKey =
        design.id === "archer"
          ? "archer_idle"
          : design.id === "bomb"
            ? "bomb_idle"
            : design.id === "spear"
              ? "spear_idle"
              : design.id === "gun"
                ? "gun_idle"
                : design.id === "water_cannon"
                  ? "water_cannon_idle_ne"
                  : design.id === "chinthe"
                    ? "chinthe_idle_ne"
                    : design.id === "dragon"
                      ? "dragon_idle_ne"
                      : design.id === "sein_pyaung"
                        ? "sein_pyaung_idle_ne"
                        : "bell_idle";
      const holderScale = this.map.holderScale ?? 1.0;
      if (this.scene.textures.exists(sheetKey)) {
        sprite = this.scene.add
          .sprite(slot.x, slot.y, sheetKey, 0)
          .setOrigin(design.origin.x, design.origin.y)
          .setScale((design.id === "dragon" ? 0.15 : 0.18) * holderScale)
          .setDisplaySize(design.displaySize.width * holderScale, design.displaySize.height * holderScale)
          .setDepth(actorDepth(slot.y));
        if (this.scene.anims.exists(idleKey)) {
          sprite.play(idleKey, true);
        }
      } else {
        sprite = this.scene.add
          .sprite(slot.x, slot.y, design.textureKey)
          .setOrigin(design.origin.x, design.origin.y)
          .setDisplaySize(design.displaySize.width * holderScale, design.displaySize.height * holderScale)
          .setDepth(actorDepth(slot.y));
      }
    } else {
      const holderScale = this.map.holderScale ?? 1.0;
      sprite = this.scene.add
        .sprite(slot.x, slot.y, design.textureKey)
        .setOrigin(design.origin.x, design.origin.y)
        .setDisplaySize(design.displaySize.width * holderScale, design.displaySize.height * holderScale)
        .setDepth(actorDepth(slot.y));
    }

    const levelBadge = this.createTowerLevelBadge(slot, tower.level);

    sprite.setInteractive({ useHandCursor: true });
    let towerDownX = 0;
    let towerDownY = 0;
    sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      towerDownX = pointer.x;
      towerDownY = pointer.y;
    });
    sprite.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const dist = Math.hypot(pointer.x - towerDownX, pointer.y - towerDownY);
      if (dist < 12 && !this.wasRecentlyDragged()) {
        const record = this.towers.get(slot.slotIndex);
        if (record) this.selectTower(slot, record);
      }
    });

    this.towers.set(slot.slotIndex, { id, tower, sprite, levelBadge });
    this.towerLastCooldown.set(slot.slotIndex, tower.cooldown);
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

      const initialArmor =
        mob.effects?.get(EFFECT_TYPES.armor_stack)?.magnitude ?? 0;
      const initialMental =
        mob.effects?.get(EFFECT_TYPES.mental_stack)?.magnitude ?? 0;
      const initialCrush =
        mob.effects?.get(EFFECT_TYPES.armor_crush)?.magnitude ?? 0;
      const initialSilenced = mob.effects?.has(EFFECT_TYPES.silence) ?? false;

      const record: MobRecord = {
        id: String(key),
        typeId: mob.typeId,
        x: 0,
        y: 0,
        sprite,
        hpBg,
        hpFill,
        lastArmorStacks: initialArmor,
        lastMentalStacks: initialMental,
        lastArmorCrush: initialCrush,
        wasSilenced: initialSilenced,
        burstBroken: false,
        lastProgress: mob.progress ?? 0,
      };
      this.mobSprites.set(mob, record);
      this.mobsById.set(record.id, record);
      // Same y-sorted layer as towers, so the two occlude by world y.
      (this.actors ?? this.root)?.add([sprite, hpBg, hpFill]);
      this.updateMobSprite(mob, record);
    };

    const onRemove = (value: unknown): void => {
      const record = this.mobSprites.get(value as Mob);
      if (!record) return;

      const mob = value as Mob;
      const progress = mob?.progress ?? record.lastProgress ?? 0;
      const isBreach = progress >= 0.95;

      if (isBreach) {
        this.triggerBaseBreach();
      } else {
        const vfx = UnitAnimationManager.spawnMobDeathVfx(
          this.scene,
          record.sprite.x,
          record.sprite.y,
          record.typeId,
        );
        if (vfx) {
          vfx.setDepth(DEPTH.PROJECTILES_LAYER + 0.5);
          (this.actors ?? this.root)?.add(vfx);
        }
      }

      record.vfxSprites?.forEach((vfx) => vfx.destroy());
      record.vfxSprites?.clear();
      record.sprite.destroy();
      record.hpBg.destroy();
      record.hpFill.destroy();
      this.mobsById.delete(record.id);
      this.mobSprites.delete(value as Mob);
    };

    // Third parameter `true` immediately renders mobs already present in state.
    this.unsubscribers.push(callbacks.onAdd("mobs", onAdd, true));
    this.unsubscribers.push(callbacks.onRemove("mobs", onRemove));

    const offMobAbility = this.room.onMessage(
      MESSAGES.mobAbility,
      (payload: MobAbilityPayload) => {
        if (this.destroyed) return;

        const caster = this.mobsById.get(payload.casterId);
        if (caster) {
          UnitAnimationManager.playCastAnimation(
            this.scene,
            caster.sprite,
            caster.typeId,
          );
        }

        if (
          payload.abilityType === "heal_aura" ||
          payload.abilityType === "speed_aura" ||
          payload.abilityType === "self_heal"
        ) {
          for (const targetId of payload.targetIds) {
            const target = this.mobsById.get(targetId);
            if (!target) continue;

            const container = this.actors ?? this.root;
            if (
              container &&
              (payload.abilityType === "heal_aura" ||
                payload.abilityType === "self_heal")
            ) {
              const amount =
                payload.healedAmounts?.[targetId] ??
                payload.healAmount ??
                (payload.abilityType === "heal_aura" ? 80 : 46);
              if (amount > 0) {
                FloatingCombatTextManager.spawnHeal(
                  this.scene,
                  container,
                  target.sprite.x,
                  target.sprite.y,
                  amount,
                );
              } else {
                FloatingCombatTextManager.spawnStatus(
                  this.scene,
                  container,
                  target.sprite.x,
                  target.sprite.y,
                  "status_exhausted",
                  "EXHAUSTED",
                );
              }
            } else if (container && payload.abilityType === "speed_aura") {
              FloatingCombatTextManager.spawnStatus(
                this.scene,
                container,
                target.sprite.x,
                target.sprite.y,
                "status_speed_burst",
                "SPEED BOOST!",
              );
            }

            const vfx =
              payload.abilityType === "heal_aura"
                ? UnitAnimationManager.spawnHealVfx(
                    this.scene,
                    target.sprite.x,
                    target.sprite.y,
                  )
                : payload.abilityType === "self_heal"
                  ? UnitAnimationManager.spawnBruteHealVfx(
                      this.scene,
                      target.sprite.x,
                      target.sprite.y,
                    )
                  : UnitAnimationManager.spawnSpeedBoostVfx(
                      this.scene,
                      target.sprite.x,
                      target.sprite.y,
                    );
            if (vfx) {
              vfx.setDepth(target.sprite.depth + 0.0001);
              (this.actors ?? this.root)?.add(vfx);
              if (!target.vfxSprites) {
                target.vfxSprites = new Set();
              }
              target.vfxSprites.add(vfx);
              vfx.once(Phaser.GameObjects.Events.DESTROY, () => {
                target.vfxSprites?.delete(vfx);
              });
            }
          }
        }
      },
    );
    this.unsubscribers.push(offMobAbility);

    const offTowerAttack = this.room.onMessage(
      MESSAGES.towerAttack,
      (payload: TowerAttackPayload) => {
        if (this.destroyed) return;

        const towerRecord = this.towers.get(payload.slotIndex);
        if (towerRecord && getTowerDesign(payload.typeId).id === "bell") {
          soundEffects.playTowerShoot("bell");
          if (payload.targets && payload.targets.length > 0) {
            soundEffects.playTowerImpact("bell");
          }
          const sprite = towerRecord.sprite as Phaser.GameObjects.Sprite;
          if (this.scene.anims.exists("bell_attack")) {
            sprite.setTexture("tower_bell_sheet");
            sprite.play("bell_attack");
            sprite.once("animationcomplete-bell_attack", () => {
              if (sprite.active && this.scene.anims.exists("bell_idle")) {
                sprite.setTexture("tower_bell_sheet");
                sprite.play("bell_idle");
              }
            });
          }
        }

        if (getTowerDesign(payload.typeId).id === "bell") {
          for (const hit of payload.targets) {
            const target = this.mobsById.get(hit.id);
            const x = target ? target.sprite.x : hit.x;
            const y = target ? target.sprite.y : hit.y;
            const vfx = TowerAnimationManager.spawnBellAttackVfx(
              this.scene,
              x,
              y,
            );
            if (!vfx) continue;

            (this.actors ?? this.root)?.add(vfx);
            if (target) {
              vfx.setDepth(target.sprite.depth + 0.0001);
              if (!target.vfxSprites) {
                target.vfxSprites = new Set();
              }
              target.vfxSprites.add(vfx);
              vfx.once(Phaser.GameObjects.Events.DESTROY, () => {
                target.vfxSprites?.delete(vfx);
              });
            } else {
              vfx.setDepth(actorDepth(y) + 0.0001);
            }
          }
        }
      },
    );
    this.unsubscribers.push(offTowerAttack);

    const offDeathExplosion = this.room.onMessage(
      MESSAGES.mobDeathExplosion,
      (payload: MobDeathExplosionPayload) => {
        if (this.destroyed) return;

        const target = this.mobsById.get(payload.mobId);
        const x = target ? target.x : payload.x;
        const y = target ? target.y : payload.y;

        const vfx = TowerAnimationManager.spawnDragonExplosionVfx(
          this.scene,
          x,
          y,
        );
        if (vfx) {
          vfx.setDepth(actorDepth(y) + 0.0005);
          (this.actors ?? this.root)?.add(vfx);
        }
      },
    );
    this.unsubscribers.push(offDeathExplosion);

    const offGunBountyProc = this.room.onMessage(
      MESSAGES.gunBountyProc,
      (payload: GunBountyProcPayload) => {
        if (this.destroyed) return;

        const target = this.mobsById.get(payload.mobId);
        const x = target ? target.x : payload.x;
        const y = target ? target.y : payload.y;

        const vfx = TowerAnimationManager.spawnGunBountyProcVfx(
          this.scene,
          x,
          y,
        );
        if (vfx) {
          vfx.setDepth(actorDepth(y) + 0.0006);
          (this.actors ?? this.root)?.add(vfx);
        }

        const container = this.actors ?? this.root;
        if (container) {
          FloatingCombatTextManager.spawnStatus(
            this.scene,
            container,
            x,
            y - 12,
            "status_bounty",
            `+${payload.bonusGold} GOLD`,
          );
        }
      },
    );
    this.unsubscribers.push(offGunBountyProc);

    const offCombatDamage = this.room.onMessage(
      MESSAGES.combatDamage,
      (payload: CombatDamagePayload) => {
        if (this.destroyed) return;

        const target = this.mobsById.get(payload.mobId);
        const x = target ? target.sprite.x : payload.x;
        const y = target ? target.sprite.y : payload.y;
        const container = this.actors ?? this.root;
        if (container) {
          FloatingCombatTextManager.spawnDamage(
            this.scene,
            container,
            x,
            y,
            payload.damage,
            payload.damageType,
            payload.isCrit,
          );
        }
      },
    );
    this.unsubscribers.push(offCombatDamage);
  }

  /** Per-frame pass repositioning every tracked mob sprite and its health bar. */
  private updateMobs(): void {
    if (this.destroyed || this.mobSprites.size === 0) return;
    this.mobSprites.forEach((record, mob) => this.updateMobSprite(mob, record));
  }

  /**
   * Spawns Sone Ma curse/stun VFX on a newly stunned tower.
   */
  private playTowerStunVfx(record: TowerRecord): void {
    record.stunVfx?.destroy();
    record.stunVfx = undefined;

    const vfx = UnitAnimationManager.spawnSoneMaStunVfx(
      this.scene,
      record.sprite.x,
      record.sprite.y,
    );
    if (!vfx) return;

    vfx.setDepth(record.sprite.depth + 0.0001);
    (this.actors ?? this.root)?.add(vfx);
    record.stunVfx = vfx;

    const container = this.actors ?? this.root;
    if (container) {
      FloatingCombatTextManager.spawnStatus(
        this.scene,
        container,
        record.sprite.x,
        record.sprite.y - 45,
        "status_stun",
        "STUNNED!",
      );
    }

    vfx.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (record.stunVfx === vfx) {
        record.stunVfx = undefined;
      }
    });
  }

  /**
   * Turns each tower to face the mob it is shooting.
   */
  private updateTowerFacing(): void {
    if (this.destroyed || this.towers.size === 0) return;

    for (const record of this.towers.values()) {
      const isStunned = record.tower.effects?.has(TOWER_EFFECT_TYPES.stun);
      if (isStunned) {
        record.sprite.setTint(0x94a3b8);
        if (record.sprite.anims?.isPlaying) {
          record.sprite.anims.pause();
        }

        if (!record.wasStunned) {
          record.wasStunned = true;
          this.playTowerStunVfx(record);
        }

        continue;
      } else {
        record.sprite.setTint(0xffffff);
        if (record.sprite.anims?.isPaused) {
          record.sprite.anims.resume();
        }

        if (record.wasStunned) {
          record.wasStunned = false;
          record.stunVfx?.destroy();
          record.stunVfx = undefined;
        }
      }
      const design = getTowerDesign(record.tower.typeId);
      if (
        design.id === "archer" ||
        design.id === "bomb" ||
        design.id === "spear" ||
        design.id === "gun"
      ) {
        const sprite = record.sprite as Phaser.GameObjects.Sprite;
        const targetId = record.tower.targetId;
        let slotIndex = -1;
        for (const [k, v] of this.towers) {
          if (v === record) {
            slotIndex = k;
            break;
          }
        }
        const lastCd = this.towerLastCooldown.get(slotIndex) ?? record.tower.cooldown;
        const justFired = !!(targetId && record.tower.cooldown > lastCd + 0.05);
        this.towerLastCooldown.set(slotIndex, record.tower.cooldown);

        if (targetId) {
          const target = this.mobsById.get(targetId);
          if (target) {
            const dx = target.x - sprite.x;
            if (Math.abs(dx) > 0.5) sprite.setFlipX(dx < 0);
          }
        }

        const fireKey = `${design.id}_fire`;
        const idleKey = `${design.id}_idle`;

        if (justFired && this.scene.anims.exists(fireKey)) {
          sprite.play(fireKey);
          sprite.once(`animationcomplete-${fireKey}`, () => {
            if (sprite.active && this.scene.anims.exists(idleKey)) {
              sprite.play(idleKey, true);
            }
          });
        } else {
          const cur = sprite.anims?.currentAnim?.key || "";
          if (
            !(cur === fireKey && sprite.anims?.isPlaying) &&
            this.scene.anims.exists(idleKey)
          ) {
            sprite.play(idleKey, true);
          }
        }
        continue;
      }
      if (design.id === "bell") {
        const sprite = record.sprite as Phaser.GameObjects.Sprite;
        const cur = sprite.anims?.currentAnim?.key || "";
        if (
          !(cur === "bell_attack" && sprite.anims?.isPlaying) &&
          this.scene.anims.exists("bell_idle")
        ) {
          if (cur !== "bell_idle" || !sprite.anims?.isPlaying) {
            sprite.setTexture("tower_bell_sheet");
            sprite.play("bell_idle");
          }
        }
        continue;
      }
      if (design.id === "cannon") {
        const targetId = record.tower.targetId;
        if (!targetId) continue;
        const target = this.mobsById.get(targetId);
        if (!target) continue;
        const dx = target.x - record.sprite.x;
        if (Math.abs(dx) > 0.5) record.sprite.setFlipX(dx < 0);
        continue;
      }
      if (
        design.id === "water_cannon" ||
        design.id === "chinthe" ||
        design.id === "dragon" ||
        design.id === "sein_pyaung"
      ) {
        const targetId = record.tower.targetId;
        const sprite = record.sprite as Phaser.GameObjects.Sprite;
        let slotIndex = -1;
        for (const [k, v] of this.towers) {
          if (v === record) { slotIndex = k; break; }
        }
        const lastCd = this.towerLastCooldown.get(slotIndex) ?? record.tower.cooldown;
        const justFired = !!(targetId && record.tower.cooldown > lastCd + 0.05);
        this.towerLastCooldown.set(slotIndex, record.tower.cooldown);

        const getSheets = () => {
          if (design.id === "water_cannon") return { sheet: "tower_water_cannon_sheet", mirror: "tower_water_cannon_sheet_mirrored", pre: "water_cannon" };
          if (design.id === "chinthe") return { sheet: "tower_chinthe_sheet", mirror: "tower_chinthe_sheet_mirrored", pre: "chinthe" };
          if (design.id === "dragon") return { sheet: "tower_dragon_sheet", mirror: "tower_dragon_sheet_mirrored", pre: "dragon" };
          if (design.id === "sein_pyaung") return { sheet: "tower_sein_pyaung_sheet", mirror: "tower_sein_pyaung_sheet_mirrored", pre: "sein_pyaung" };
          return { sheet: "tower_water_cannon_sheet", mirror: "tower_water_cannon_sheet_mirrored", pre: "water_cannon" };
        };
        const sh = getSheets();

        if (!targetId) {
          const idle = sh.pre + "_idle_ne";
          if (this.scene.anims.exists(idle)) {
            const cur = sprite.anims?.currentAnim?.key || "";
            if (cur !== idle || !sprite.anims?.isPlaying) { sprite.setTexture(sh.sheet); sprite.play(idle); }
          }
          continue;
        }
        const target = this.mobsById.get(targetId);
        if (!target) { continue; }

        const pivotY = sprite.y + TOWER_AIM_PIVOT_Y_OFFSET;
        const dx = target.x - sprite.x;
        const dy = target.y - pivotY;
        const enemyOnRight = dx >= 0;
        const enemyAbove = dy < 0;

        if (enemyOnRight) {
          if (enemyAbove) {
            if (justFired && this.scene.anims.exists(sh.pre + "_fire_ne")) {
              sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_fire_ne");
              sprite.once("animationcomplete-" + sh.pre + "_fire_ne", () => {
                const t = this.towers.get(slotIndex);
                if (t?.tower.targetId) {
                  const tt = this.mobsById.get(t.tower.targetId);
                  if (tt) {
                    const tdx = tt.x - sprite.x; const tdy = tt.y - pivotY;
                    if (tdx < 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_nw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_nw"); }
                    else if (tdx < 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_sw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_sw"); }
                    else if (tdx >= 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_ne")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_ne"); }
                    else if (tdx >= 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_se")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_se"); }
                  }
                }
              });
            } else {
              const cur = sprite.anims?.currentAnim?.key || "";
              if (!(cur.includes("fire") && sprite.anims?.isPlaying) && this.scene.anims.exists(sh.pre + "_idle_ne")) {
                if (cur !== sh.pre + "_idle_ne") { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_ne"); }
              }
            }
          } else {
            if (justFired && this.scene.anims.exists(sh.pre + "_fire_se")) {
              sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_fire_se");
              sprite.once("animationcomplete-" + sh.pre + "_fire_se", () => {
                const t = this.towers.get(slotIndex);
                if (t?.tower.targetId) {
                  const tt = this.mobsById.get(t.tower.targetId);
                  if (tt) {
                    const tdx = tt.x - sprite.x; const tdy = tt.y - pivotY;
                    if (tdx < 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_nw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_nw"); }
                    else if (tdx < 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_sw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_sw"); }
                    else if (tdx >= 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_ne")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_ne"); }
                    else if (tdx >= 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_se")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_se"); }
                  }
                }
              });
            } else {
              const cur = sprite.anims?.currentAnim?.key || "";
              if (!(cur.includes("fire") && sprite.anims?.isPlaying) && this.scene.anims.exists(sh.pre + "_idle_se")) {
                if (cur !== sh.pre + "_idle_se") { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_se"); }
              }
            }
          }
        } else {
          if (enemyAbove) {
            if (justFired && this.scene.anims.exists(sh.pre + "_fire_nw")) {
              sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_fire_nw");
              sprite.once("animationcomplete-" + sh.pre + "_fire_nw", () => {
                const t = this.towers.get(slotIndex);
                if (t?.tower.targetId) {
                  const tt = this.mobsById.get(t.tower.targetId);
                  if (tt) {
                    const tdx = tt.x - sprite.x; const tdy = tt.y - pivotY;
                    if (tdx < 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_nw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_nw"); }
                    else if (tdx < 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_sw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_sw"); }
                    else if (tdx >= 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_ne")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_ne"); }
                    else if (tdx >= 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_se")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_se"); }
                  }
                }
              });
            } else {
              const cur = sprite.anims?.currentAnim?.key || "";
              if (!(cur.includes("fire") && sprite.anims?.isPlaying) && this.scene.anims.exists(sh.pre + "_idle_nw")) {
                if (cur !== sh.pre + "_idle_nw") { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_nw"); }
              }
            }
          } else {
            if (justFired && this.scene.anims.exists(sh.pre + "_fire_sw")) {
              sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_fire_sw");
              sprite.once("animationcomplete-" + sh.pre + "_fire_sw", () => {
                const t = this.towers.get(slotIndex);
                if (t?.tower.targetId) {
                  const tt = this.mobsById.get(t.tower.targetId);
                  if (tt) {
                    const tdx = tt.x - sprite.x; const tdy = tt.y - pivotY;
                    if (tdx < 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_nw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_nw"); }
                    else if (tdx < 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_sw")) { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_sw"); }
                    else if (tdx >= 0 && tdy < 0 && this.scene.anims.exists(sh.pre + "_idle_ne")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_ne"); }
                    else if (tdx >= 0 && tdy >= 0 && this.scene.anims.exists(sh.pre + "_idle_se")) { sprite.setTexture(sh.sheet); sprite.play(sh.pre + "_idle_se"); }
                  }
                }
              });
            } else {
              const cur = sprite.anims?.currentAnim?.key || "";
              if (!(cur.includes("fire") && sprite.anims?.isPlaying) && this.scene.anims.exists(sh.pre + "_idle_sw")) {
                if (cur !== sh.pre + "_idle_sw") { sprite.setTexture(sh.mirror); sprite.play(sh.pre + "_idle_sw"); }
              }
            }
          }
        }
        continue;
      }
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
    record.y = point.y;
    record.lastProgress = mob.progress;

    if (record.vfxSprites && record.vfxSprites.size > 0) {
      record.vfxSprites.forEach((vfx) => {
        if (vfx.active) {
          vfx.setPosition(point.x, point.y);
          vfx.setDepth(actorDepth(point.y) + 0.0001);
        }
      });
    }

    // Status tint: a slowed mob reads cold blue, a cracked one violet.
    record.sprite.setTint(this.mobEffectTint(mob));

    const container = this.actors ?? this.root;

    // Adaptive defense stack VFX and status alert for Belu Ogre
    if (record.typeId === "belu") {
      const currentArmor =
        mob.effects?.get(EFFECT_TYPES.armor_stack)?.magnitude ?? 0;
      const currentMental =
        mob.effects?.get(EFFECT_TYPES.mental_stack)?.magnitude ?? 0;

      if (currentArmor > (record.lastArmorStacks ?? 0)) {
        if (container) {
          FloatingCombatTextManager.spawnStatus(
            this.scene,
            container,
            point.x,
            point.y - 28,
            "status_armor_stack",
            `+ARMOR (${currentArmor})`,
          );
        }
        const vfx = UnitAnimationManager.spawnBeluArmorVfx(
          this.scene,
          point.x,
          point.y,
        );
        if (vfx) {
          vfx.setDepth(record.sprite.depth + 0.0001);
          (this.actors ?? this.root)?.add(vfx);
          if (!record.vfxSprites) {
            record.vfxSprites = new Set();
          }
          record.vfxSprites.add(vfx);
          vfx.once(Phaser.GameObjects.Events.DESTROY, () => {
            record.vfxSprites?.delete(vfx);
          });
        }
      }

      if (currentMental > (record.lastMentalStacks ?? 0)) {
        if (container) {
          FloatingCombatTextManager.spawnStatus(
            this.scene,
            container,
            point.x,
            point.y - 28,
            "status_mental_stack",
            `+RESOLVE (${currentMental})`,
          );
        }
        const vfx = UnitAnimationManager.spawnBeluMentalVfx(
          this.scene,
          point.x,
          point.y,
        );
        if (vfx) {
          vfx.setDepth(record.sprite.depth + 0.0001);
          (this.actors ?? this.root)?.add(vfx);
          if (!record.vfxSprites) {
            record.vfxSprites = new Set();
          }
          record.vfxSprites.add(vfx);
          vfx.once(Phaser.GameObjects.Events.DESTROY, () => {
            record.vfxSprites?.delete(vfx);
          });
        }
      }

      record.lastArmorStacks = currentArmor;
      record.lastMentalStacks = currentMental;
    }

    // Sein Pyaung Armor Crush alert
    const currentCrush =
      mob.effects?.get(EFFECT_TYPES.armor_crush)?.magnitude ?? 0;
    if (currentCrush > (record.lastArmorCrush ?? 0)) {
      if (container) {
        FloatingCombatTextManager.spawnStatus(
          this.scene,
          container,
          point.x,
          point.y - 28,
          "status_armor_crush",
          "ARMOR CRUSH!",
        );
      }
    }
    record.lastArmorCrush = currentCrush;

    // Chinthe Guardian Silence alert
    const isSilenced = mob.effects?.has(EFFECT_TYPES.silence) ?? false;
    if (isSilenced && !record.wasSilenced) {
      if (container) {
        FloatingCombatTextManager.spawnStatus(
          this.scene,
          container,
          point.x,
          point.y - 28,
          "status_silence",
          "SILENCED!",
        );
      }
    }
    record.wasSilenced = isSilenced;

    // Monkey Burst of Speed drop alert upon taking first damage
    if (record.typeId === "monkey") {
      if (!record.burstBroken && mob.speed <= 50) {
        record.burstBroken = true;
        if (container) {
          FloatingCombatTextManager.spawnStatus(
            this.scene,
            container,
            point.x,
            point.y - 28,
            "status_speed_broken",
            "BURST BROKEN",
          );
        }
      }
    }

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
      soundEffects.playTowerShoot(design.id);
      const textureKey = this.scene.textures.exists(design.projectileKey)
        ? design.projectileKey
        : "arrow_proj";

      let sprite: Phaser.GameObjects.Sprite;
      if (design.id === "archer") {
        if (!this.scene.textures.exists("archer_vfx_sheet")) {
          this.scene.load.spritesheet("archer_vfx_sheet", "/assets/towers/01_archer_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("archer_vfx_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "archer_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.05).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("archer_proj_anim")) {
            this.scene.anims.create({ key: "archer_proj_anim", frames: this.scene.anims.generateFrameNumbers("archer_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("archer_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "bomb") {
        if (!this.scene.textures.exists("bomb_vfx_sheet")) {
          this.scene.load.spritesheet("bomb_vfx_sheet", "/assets/towers/03_bomb_throwing_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("bomb_vfx_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "bomb_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.05).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("bomb_proj_anim")) {
            this.scene.anims.create({ key: "bomb_proj_anim", frames: this.scene.anims.generateFrameNumbers("bomb_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("bomb_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "spear") {
        if (!this.scene.textures.exists("spear_vfx_sheet")) {
          this.scene.load.spritesheet("spear_vfx_sheet", "/assets/towers/05_spear_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("spear_vfx_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "spear_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.05).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("spear_proj_anim")) {
            this.scene.anims.create({ key: "spear_proj_anim", frames: this.scene.anims.generateFrameNumbers("spear_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("spear_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "water_cannon") {
        if (!this.scene.textures.exists("water_splash_sheet")) {
          this.scene.load.spritesheet("water_splash_sheet", "/assets/towers/07_water_cannon/water_splash.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("water_splash_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "water_splash_sheet").setOrigin(0.5, 0.5).setScale(0.04).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("water_proj_anim")) {
            this.scene.anims.create({ key: "water_proj_anim", frames: this.scene.anims.generateFrameNumbers("water_splash_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("water_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "chinthe") {
        if (!this.scene.textures.exists("chinthe_attack_sheet")) {
          this.scene.load.spritesheet("chinthe_attack_sheet", "/assets/towers/08_chinthe_statue/chinthe_attack.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("chinthe_attack_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "chinthe_attack_sheet").setOrigin(0.5, 0.5).setScale(0.04).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("chinthe_proj_anim")) {
            this.scene.anims.create({ key: "chinthe_proj_anim", frames: this.scene.anims.generateFrameNumbers("chinthe_attack_sheet", { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
          }
          sprite.play("chinthe_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "dragon") {
        if (!this.scene.textures.exists("dragon_attack_sheet")) {
          this.scene.load.spritesheet("dragon_attack_sheet", "/assets/towers/09_dragon_tower/dragon_attack.png", { frameWidth: 600, frameHeight: 597 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("dragon_attack_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "dragon_attack_sheet").setOrigin(0.5, 0.5).setScale(0.05).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("dragon_proj_anim")) {
            this.scene.anims.create({ key: "dragon_proj_anim", frames: this.scene.anims.generateFrameNumbers("dragon_attack_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("dragon_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "sein_pyaung") {
        if (!this.scene.textures.exists("sein_pyaung_vfx_sheet")) {
          this.scene.load.spritesheet("sein_pyaung_vfx_sheet", "/assets/towers/10_sein_pyaung/vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("sein_pyaung_vfx_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "sein_pyaung_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.05).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("sein_pyaung_proj_anim")) {
            this.scene.anims.create({ key: "sein_pyaung_proj_anim", frames: this.scene.anims.generateFrameNumbers("sein_pyaung_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("sein_pyaung_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else if (design.id === "gun") {
        if (!this.scene.textures.exists("gun_vfx_sheet")) {
          this.scene.load.spritesheet("gun_vfx_sheet", "/assets/towers/06_gun_tower/shooting_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("gun_vfx_sheet")) {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, "gun_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.06).setDepth(DEPTH.PROJECTILES_LAYER);
          if (!this.scene.anims.exists("gun_proj_anim")) {
            this.scene.anims.create({ key: "gun_proj_anim", frames: this.scene.anims.generateFrameNumbers("gun_vfx_sheet", { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
          }
          sprite.play("gun_proj_anim");
        } else {
          sprite = this.scene.add.sprite(projectile.x, projectile.y, textureKey).setOrigin(0.5, 0.5).setDisplaySize(28, 28).setDepth(DEPTH.PROJECTILES_LAYER);
        }
      } else {
        sprite = this.scene.add
          .sprite(projectile.x, projectile.y, textureKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(28, 28)
          .setDepth(DEPTH.PROJECTILES_LAYER);
      }

      const initialTarget = projectile.targetId
        ? this.mobsById.get(projectile.targetId)
        : undefined;
      if (initialTarget) {
        const idx = initialTarget.x - projectile.x;
        const idy = initialTarget.y - projectile.y;
        if (idx * idx + idy * idy > 0.01) {
          sprite.setRotation(Math.atan2(idy, idx));
        }
      }

      this.projectileSprites.set(projectile, sprite);
      this.root?.add(sprite);
    };

    const onRemove = (value: unknown): void => {
      const projectile = value as Projectile;
      const sprite = this.projectileSprites.get(projectile);
      if (!sprite) return;
      const design = getTowerDesign(projectile.typeId);
      soundEffects.playTowerImpact(design.id);
      if (design.id === "archer") {
        if (!this.scene.textures.exists("archer_vfx_sheet")) {
          this.scene.load.spritesheet("archer_vfx_sheet", "/assets/towers/01_archer_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("archer_vfx_sheet")) {
          const splash = this.scene.add.sprite(sprite.x, sprite.y, "archer_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.07).setDepth(DEPTH.PROJECTILES_LAYER + 1);
          if (!this.scene.anims.exists("archer_splash_anim")) {
            this.scene.anims.create({ key: "archer_splash_anim", frames: this.scene.anims.generateFrameNumbers("archer_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
          }
          splash.play("archer_splash_anim");
          splash.once("animationcomplete", () => splash.destroy());
          (this.root ?? this.actors)?.add(splash);
        }
      } else if (design.id === "bomb") {
        if (!this.scene.textures.exists("bomb_vfx_sheet")) {
          this.scene.load.spritesheet("bomb_vfx_sheet", "/assets/towers/03_bomb_throwing_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("bomb_vfx_sheet")) {
          const splash = this.scene.add.sprite(sprite.x, sprite.y, "bomb_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.08).setDepth(DEPTH.PROJECTILES_LAYER + 1);
          if (!this.scene.anims.exists("bomb_splash_anim")) {
            this.scene.anims.create({ key: "bomb_splash_anim", frames: this.scene.anims.generateFrameNumbers("bomb_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
          }
          splash.play("bomb_splash_anim");
          splash.once("animationcomplete", () => splash.destroy());
          (this.root ?? this.actors)?.add(splash);
        }
      } else if (design.id === "spear") {
        if (!this.scene.textures.exists("spear_vfx_sheet")) {
          this.scene.load.spritesheet("spear_vfx_sheet", "/assets/towers/05_spear_tower/projectile_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("spear_vfx_sheet")) {
          const splash = this.scene.add.sprite(sprite.x, sprite.y, "spear_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.07).setDepth(DEPTH.PROJECTILES_LAYER + 1);
          if (!this.scene.anims.exists("spear_splash_anim")) {
            this.scene.anims.create({ key: "spear_splash_anim", frames: this.scene.anims.generateFrameNumbers("spear_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
          }
          splash.play("spear_splash_anim");
          splash.once("animationcomplete", () => splash.destroy());
          (this.root ?? this.actors)?.add(splash);
        }
      } else if (design.id === "water_cannon") {
        if (!this.scene.textures.exists("water_splash_sheet")) {
          this.scene.load.spritesheet("water_splash_sheet", "/assets/towers/07_water_cannon/water_splash.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("water_splash_sheet")) {
          const splash = this.scene.add.sprite(sprite.x, sprite.y, "water_splash_sheet").setOrigin(0.5, 0.5).setScale(0.06).setDepth(DEPTH.PROJECTILES_LAYER + 1);
          if (!this.scene.anims.exists("water_splash_anim")) {
            this.scene.anims.create({ key: "water_splash_anim", frames: this.scene.anims.generateFrameNumbers("water_splash_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
          }
          splash.play("water_splash_anim");
          splash.once("animationcomplete", () => splash.destroy());
          (this.root ?? this.actors)?.add(splash);
        }
      } else if (design.id === "dragon") {
        if (!this.scene.textures.exists("dragon_attack_sheet")) {
          this.scene.load.spritesheet("dragon_attack_sheet", "/assets/towers/09_dragon_tower/dragon_attack.png", { frameWidth: 600, frameHeight: 597 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("dragon_attack_sheet")) {
          const splash = this.scene.add.sprite(sprite.x, sprite.y, "dragon_attack_sheet").setOrigin(0.5, 0.5).setScale(0.08).setDepth(DEPTH.PROJECTILES_LAYER + 1);
          if (!this.scene.anims.exists("dragon_splash_anim")) {
            this.scene.anims.create({ key: "dragon_splash_anim", frames: this.scene.anims.generateFrameNumbers("dragon_attack_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
          }
          splash.play("dragon_splash_anim");
          splash.once("animationcomplete", () => splash.destroy());
          (this.root ?? this.actors)?.add(splash);
        }
      } else if (design.id === "sein_pyaung") {
        if (!this.scene.textures.exists("sein_pyaung_vfx_sheet")) {
          this.scene.load.spritesheet("sein_pyaung_vfx_sheet", "/assets/towers/10_sein_pyaung/vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        if (this.scene.textures.exists("sein_pyaung_vfx_sheet")) {
          const splash = this.scene.add.sprite(sprite.x, sprite.y, "sein_pyaung_vfx_sheet").setOrigin(0.5, 0.5).setScale(0.07).setDepth(DEPTH.PROJECTILES_LAYER + 1);
          if (!this.scene.anims.exists("sein_pyaung_splash_anim")) {
            this.scene.anims.create({ key: "sein_pyaung_splash_anim", frames: this.scene.anims.generateFrameNumbers("sein_pyaung_vfx_sheet", { start: 4, end: 7 }), frameRate: 15, repeat: 0 });
          }
          splash.play("sein_pyaung_splash_anim");
          splash.once("animationcomplete", () => splash.destroy());
          (this.root ?? this.actors)?.add(splash);
        }
      } else if (design.id === "gun") {
        if (!this.scene.textures.exists("gun_vfx_sheet")) {
          this.scene.load.spritesheet("gun_vfx_sheet", "/assets/towers/06_gun_tower/shooting_vfx.png", { frameWidth: 688, frameHeight: 768 });
          this.scene.load.start();
        }
        const hit = TowerAnimationManager.spawnGunHitVfx(this.scene, sprite.x, sprite.y);
        if (hit) {
          (this.root ?? this.actors)?.add(hit);
        }
      }
      // chinthe: whole 8 frames is projectile animation as specified
      sprite.destroy();
      this.projectileSprites.delete(projectile);
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

    if (this.lastCoreHp !== undefined && coreHp < this.lastCoreHp) {
      const lostHp = this.lastCoreHp - coreHp;
      this.triggerBaseBreach(lostHp);
    }
    this.lastCoreHp = coreHp;
  }

  /**
   * Triggers visual and camera impact feedback when the defender's base castle is breached.
   */
  private triggerBaseBreach(lostHp?: number): void {
    if (!this.map.base) return;
    const now = performance.now();
    // Throttle multiple simultaneous breach animations within 180ms
    if (now - this.lastBreachVfxTime < 180) return;
    this.lastBreachVfxTime = now;

    const baseX = this.map.base.x;
    const baseY = this.map.base.y;

    const vfx = UnitAnimationManager.spawnBaseBreachVfx(
      this.scene,
      baseX,
      baseY,
    );
    if (vfx) {
      vfx.setDepth(DEPTH.PROJECTILES_LAYER + 2);
      (this.actors ?? this.root)?.add(vfx);
    }

    // Impact punch: camera shake and base castle flash
    const shakeIntensity = lostHp
      ? Math.min(0.015, 0.006 + lostHp * 0.001)
      : 0.007;
    this.scene.cameras.main.shake(160, shakeIntensity);
    if (this.baseSprite) {
      this.baseSprite.setTint(0xff5555);
      this.scene.time.delayedCall(150, () => {
        this.baseSprite?.clearTint();
      });
    }

    if (lostHp && lostHp > 0) {
      const container = this.actors ?? this.root;
      if (container) {
        FloatingCombatTextManager.spawnStatus(
          this.scene,
          container,
          baseX,
          baseY - 40,
          "status_breach",
          `-${lostHp} HP`,
        );
      }
    }
  }

  /** Resolves a mob's `pathId` against the map's tracks. */
  private pathFor(pathId: string): Vec2[] | undefined {
    return mapPath(this.map, pathId);
  }

  /**
   * Clamps camera scroll position so visible bounds remain within the map.
   * If visible world exceeds map bounds (e.g. at low zoom), centers the map.
   */
  private clampCameraScroll(): void {
    const cam = this.scene.cameras.main;
    const visibleW = cam.width / cam.zoom;
    const visibleH = cam.height / cam.zoom;
    const mapW = this.map.width || 1280;
    const mapH = this.map.height || 720;

    if (visibleW >= mapW) {
      cam.scrollX = (mapW - cam.width) / 2;
    } else {
      const minScrollX = visibleW / 2 - cam.width / 2;
      const maxScrollX = (mapW - visibleW / 2) - cam.width / 2;
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, minScrollX, maxScrollX);
    }

    if (visibleH >= mapH) {
      cam.scrollY = (mapH - cam.height) / 2;
    } else {
      const minScrollY = visibleH / 2 - cam.height / 2;
      const maxScrollY = (mapH - visibleH / 2) - cam.height / 2;
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, minScrollY, maxScrollY);
    }
  }

  /**
   * Returns all pointers currently touching the canvas.
   */
  private getActivePointers(): Phaser.Input.Pointer[] {
    const input = this.scene.input;
    const active: Phaser.Input.Pointer[] = [];
    if (input.pointer1?.isDown) active.push(input.pointer1);
    if (input.pointer2?.isDown) active.push(input.pointer2);
    if (input.pointer3?.isDown) active.push(input.pointer3);
    if (input.mousePointer?.isDown && !active.includes(input.mousePointer)) {
      active.push(input.mousePointer);
    }
    return active;
  }

  /**
   * Returns true if the camera was dragged or pinched recently (within 150ms),
   * preventing child game objects from misinterpreting a drag release as a tap.
   */
  public wasRecentlyDragged(): boolean {
    return this.dragActive || (performance.now() - this.lastDragEndTime < 150);
  }

  /**
   * Initializes drag & pan camera controls with focal pinch-to-zoom,
   * smooth dual-pan, boundary clamping, and momentum friction.
   */
  private setupCameraControls(): void {
    const cam = this.scene.cameras.main;
    // Support up to 4 simultaneous touch pointers
    this.scene.input.addPointer(3);

    this.onCameraPointerDown = (pointer: Phaser.Input.Pointer) => {
      // Touching the canvas immediately halts any ongoing momentum glide
      this.cameraVelocityX = 0;
      this.cameraVelocityY = 0;

      const active = this.getActivePointers();

      if (active.length >= 2) {
        // Multi-touch: seed pinch-to-zoom and dual-pan gesture
        this.isPinching = true;
        this.isDragging = false;
        this.dragActive = true;
        const p1 = active[0];
        const p2 = active[1];
        this.lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        this.lastPinchMidX = (p1.x + p2.x) / 2;
        this.lastPinchMidY = (p1.y + p2.y) / 2;
      } else {
        // Single-finger touch or mouse click
        this.isPinching = false;
        this.isDragging = true;
        this.dragActive = false;
        this.dragOriginX = pointer.x;
        this.dragOriginY = pointer.y;
        this.lastPointerX = pointer.x;
        this.lastPointerY = pointer.y;
        this.lastPointerTime = performance.now();
      }
    };

    this.onCameraPointerMove = (_pointer: Phaser.Input.Pointer) => {
      const active = this.getActivePointers();

      // ─── 1. Two-finger pinch-to-zoom & dual-pan ───
      if (active.length >= 2) {
        const p1 = active[0];
        const p2 = active[1];
        const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const currentMidX = (p1.x + p2.x) / 2;
        const currentMidY = (p1.y + p2.y) / 2;

        if (!this.isPinching) {
          this.isPinching = true;
          this.isDragging = false;
          this.dragActive = true;
          this.lastPinchDistance = currentDist;
          this.lastPinchMidX = currentMidX;
          this.lastPinchMidY = currentMidY;
          this.cameraVelocityX = 0;
          this.cameraVelocityY = 0;
          return;
        }

        // Two-finger pan: camera follows the movement of the fingers' centroid
        const midDx = currentMidX - this.lastPinchMidX;
        const midDy = currentMidY - this.lastPinchMidY;
        cam.scrollX -= midDx / cam.zoom;
        cam.scrollY -= midDy / cam.zoom;

        // Focal pinch zoom: zooms around the midpoint between the fingers
        if (this.lastPinchDistance > 10 && currentDist > 10) {
          const zoomRatio = currentDist / this.lastPinchDistance;
          const targetZoom = Phaser.Math.Clamp(cam.zoom * zoomRatio, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
          if (Math.abs(targetZoom - cam.zoom) > 0.0001) {
            const worldBefore = cam.getWorldPoint(currentMidX, currentMidY);
            cam.setZoom(targetZoom);
            const worldAfter = cam.getWorldPoint(currentMidX, currentMidY);
            cam.scrollX += (worldBefore.x - worldAfter.x);
            cam.scrollY += (worldBefore.y - worldAfter.y);
          }
          this.lastPinchDistance = currentDist;
        }

        this.lastPinchMidX = currentMidX;
        this.lastPinchMidY = currentMidY;
        this.clampCameraScroll();
        return;
      }

      // ─── 2. Single-finger pan ───
      if (active.length === 1) {
        const activePointer = active[0];

        // Transition from 2 fingers to 1 finger: seamless handoff without velocity jump
        if (this.isPinching) {
          this.isPinching = false;
          this.isDragging = true;
          this.dragActive = true;
          this.lastPointerX = activePointer.x;
          this.lastPointerY = activePointer.y;
          this.lastPointerTime = performance.now();
          this.cameraVelocityX = 0;
          this.cameraVelocityY = 0;
          return;
        }

        if (!this.isDragging) {
          this.isDragging = true;
          this.dragActive = false;
          this.dragOriginX = activePointer.x;
          this.dragOriginY = activePointer.y;
          this.lastPointerX = activePointer.x;
          this.lastPointerY = activePointer.y;
          this.lastPointerTime = performance.now();
          this.cameraVelocityX = 0;
          this.cameraVelocityY = 0;
          return;
        }

        // Tap threshold: only start panning once movement exceeds threshold
        if (!this.dragActive) {
          const travel = Math.hypot(activePointer.x - this.dragOriginX, activePointer.y - this.dragOriginY);
          if (travel < CAMERA_DRAG_THRESHOLD) {
            this.lastPointerX = activePointer.x;
            this.lastPointerY = activePointer.y;
            this.lastPointerTime = performance.now();
            return;
          }
          this.dragActive = true;
          this.lastPointerX = activePointer.x;
          this.lastPointerY = activePointer.y;
          this.lastPointerTime = performance.now();
          return;
        }

        // Active camera drag
        const dx = activePointer.x - this.lastPointerX;
        const dy = activePointer.y - this.lastPointerY;
        const now = performance.now();

        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
        this.clampCameraScroll();

        // Smoothed velocity using exponential moving average
        const instantVx = -dx / cam.zoom;
        const instantVy = -dy / cam.zoom;
        this.cameraVelocityX = this.cameraVelocityX * 0.3 + instantVx * 0.7;
        this.cameraVelocityY = this.cameraVelocityY * 0.3 + instantVy * 0.7;

        this.lastPointerX = activePointer.x;
        this.lastPointerY = activePointer.y;
        this.lastPointerTime = now;
      }
    };

    this.onCameraPointerUp = () => {
      const active = this.getActivePointers();

      if (this.isPinching) {
        if (active.length < 2) {
          this.isPinching = false;
          this.lastPinchDistance = 0;
          if (active.length === 1) {
            // 1 finger still touching: seamless transition to drag
            this.isDragging = true;
            this.dragActive = true;
            this.lastPointerX = active[0].x;
            this.lastPointerY = active[0].y;
            this.lastPointerTime = performance.now();
            this.cameraVelocityX = 0;
            this.cameraVelocityY = 0;
            return;
          }
        }
      }

      if (active.length === 0) {
        if (this.dragActive) {
          this.lastDragEndTime = performance.now();
          // If the finger was held still before lifting (>90ms), suppress momentum
          if (performance.now() - this.lastPointerTime > 90) {
            this.cameraVelocityX = 0;
            this.cameraVelocityY = 0;
          } else {
            // Clamp maximum flick speed
            const maxFlick = 28;
            this.cameraVelocityX = Phaser.Math.Clamp(this.cameraVelocityX, -maxFlick, maxFlick);
            this.cameraVelocityY = Phaser.Math.Clamp(this.cameraVelocityY, -maxFlick, maxFlick);
          }
        } else {
          this.cameraVelocityX = 0;
          this.cameraVelocityY = 0;
        }

        this.isDragging = false;
        this.isPinching = false;
        // Keep dragActive briefly true so concurrent pointerup handlers on game objects know a drag occurred
        setTimeout(() => {
          this.dragActive = false;
        }, 50);
      }
    };

    this.onCameraWheel = (pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      const zoomFactor = deltaY > 0 ? 0.92 : 1.08;
      const targetZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
      if (Math.abs(targetZoom - cam.zoom) > 0.0001) {
        const worldBefore = cam.getWorldPoint(pointer.x, pointer.y);
        cam.setZoom(targetZoom);
        const worldAfter = cam.getWorldPoint(pointer.x, pointer.y);
        cam.scrollX += (worldBefore.x - worldAfter.x);
        cam.scrollY += (worldBefore.y - worldAfter.y);
        this.clampCameraScroll();
      }
    };

    this.scene.input.on("pointerdown", this.onCameraPointerDown);
    this.scene.input.on("pointermove", this.onCameraPointerMove);
    this.scene.input.on("pointerup", this.onCameraPointerUp);
    this.scene.input.on("wheel", this.onCameraWheel);
  }

  /**
   * Per-frame update for camera glide physics with framerate-independent friction decay.
   */
  update(_time: number, delta: number): void {
    const active = this.getActivePointers();
    if (this.isDragging && active.length === 0) {
      this.isDragging = false;
      this.isPinching = false;
    }

    if (!this.isDragging && !this.isPinching && (Math.abs(this.cameraVelocityX) > 0.05 || Math.abs(this.cameraVelocityY) > 0.05)) {
      const cam = this.scene.cameras.main;
      cam.scrollX += this.cameraVelocityX;
      cam.scrollY += this.cameraVelocityY;
      this.clampCameraScroll();

      // Framerate-independent exponential decay (0.92 at 60fps)
      const friction = Math.pow(0.92, (delta || 16.667) / 16.667);
      this.cameraVelocityX *= friction;
      this.cameraVelocityY *= friction;

      if (Math.abs(this.cameraVelocityX) <= 0.05) this.cameraVelocityX = 0;
      if (Math.abs(this.cameraVelocityY) <= 0.05) this.cameraVelocityY = 0;
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

    for (const record of this.towers.values()) {
      record.stunVfx?.destroy();
      record.sprite.destroy();
      record.levelBadge?.destroy();
    }
    this.towers.clear();
    this.deckCards.clear();
  }
}
