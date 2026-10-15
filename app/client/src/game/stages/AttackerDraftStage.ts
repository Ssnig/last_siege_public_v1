
import Phaser from "phaser";
import {
  DEFAULT_DECK_RULES,
  MOB_TYPES,
  type DraftReadyIntent,
  type MobType,
} from "@root/shared";
import { MobCard } from "../ui/MobCard";
import { UIButton } from "../ui/UIButton";
import {
  UI_BG_FRAMES,
  UI_BG_TEXTURE_KEY,
  UI_TEXTURE_KEY,
} from "../ui/uiAtlas";


/**
 * Client-side attacker draft UI.
 *
 * @remarks
 * The upper 70% contains the available mob roster; the lower 30% contains the
 * selected deck and confirmation action. Selection is local and unique by mob
 * ID. The selection limit is capped by the number of actual catalog entries,
 * so the UI never fabricates additional mob types to fill the deck.
 *
 * **Authority boundary:** this stage does not spend gold or modify room state.
 * Confirming a draft currently logs a `DraftReadyIntent` for later server
 * integration. `GameContainer` owns the Colyseus room lifecycle.
 */
export class AttackerDraftStage {/**
 * Sends the selected mob IDs to the server for validation.
 *
 * @remarks
 * The stage owns the UI; GameScene supplies the network callback.
 */
  private readonly onConfirm: (deck: string[]) => void;
  private readonly scene: Phaser.Scene;

  private root?: Phaser.GameObjects.Container;
  private cards: MobCard[] = [];
  private selected = new Set<string>();

  private countText?: Phaser.GameObjects.Text;
  private selectedContainer?: Phaser.GameObjects.Container;
  private confirmButton?: UIButton;

  private confirmed = false;
  private detailsOverlay?: Phaser.GameObjects.Container;

  private readonly mobs: MobType[] = Object.values(MOB_TYPES);
  private readonly maxSelections = Math.min(
    DEFAULT_DECK_RULES.deckSize,
    Object.keys(MOB_TYPES).length,
  );

  /** Stable callback reference so the resize listener can be removed. */
  private readonly handleResize = (): void => {
    this.render();
  };

  /**
   * @param scene - Active Phaser scene that owns this stage's UI.
   * @param onConfirm - Sends the selected deck to the server.
   */
  constructor(scene: Phaser.Scene, onConfirm: (deck: string[]) => void) {
    this.scene = scene;
    this.onConfirm = onConfirm;
  }

  /**
   * Builds the UI and subscribes to canvas resizing.
   *
   * @remarks Re-rendering preserves the selected mob IDs but closes any popup.
   */
  create(): void {
    this.render();
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  /**
   * Rebuilds the layout using the current canvas dimensions.
   *
   * @remarks
   * Rebuilding rather than scaling fixed coordinates keeps the 70/30 layout
   * usable across different canvas sizes. The selection set survives a resize.
   */
  private render(): void {
    this.detailsOverlay = undefined;
    this.root?.destroy(true);
    this.cards = [];

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const rosterHeight = Math.floor(height * 0.7);
    const deckHeight = height - rosterHeight;

    this.root = this.scene.add.container(0, 0);

    // Flat dark fill sits behind the art so its transparent margins never
    // expose the canvas clear colour.
    const backdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x3e2723)
      .setOrigin(0, 0);

    const background = this.scene.add
      .image(0, 0, UI_BG_TEXTURE_KEY, UI_BG_FRAMES.bg1)
      .setOrigin(0, 0)
      .setDisplaySize(width, height);

    const deckBackground = this.scene.add
      .rectangle(0, rosterHeight, width, deckHeight, 0x0b1120, 0.4)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x334155);

    this.root.add([backdrop, background, deckBackground]);

    this.createRoster(width, rosterHeight);
    this.createDeckPanel(width, rosterHeight, deckHeight);
    this.refreshSelection();
  }

  /**
   * Creates the roster heading and responsive portrait-card grid.
   *
   * @param width - Current canvas width.
   * @param rosterHeight - Height allocated to the upper roster section.
   */
  private createRoster(width: number, rosterHeight: number): void {
    const padding = Math.max(12, Math.min(24, width * 0.03));
    const headerY = Math.max(20, Math.min(30, rosterHeight * 0.08));

    // Opaque header strip keeps the roster heading legible over the bg art.
    const headerHeight = Math.max(44, Math.min(58, rosterHeight * 0.12));
    const headerBar = this.scene.add
      .rectangle(0, 0, width, headerHeight, 0x0b1120, 0.8)
      .setOrigin(0, 0);
    const headerRule = this.scene.add
      .rectangle(0, headerHeight, width, 2, 0x475569, 0.9)
      .setOrigin(0, 0);

    this.root!.add([headerBar, headerRule]);

    const title = this.scene.add.text(padding, headerY, "ATTACKER ROSTER", {
      fontSize: `${Math.max(17, Math.min(24, width * 0.035))}px`,
      fontStyle: "bold",
      color: "#f8fafc",
    }).setOrigin(0, 0.5);

    const subtitle = this.scene.add.text(
      width - padding,
      headerY,
      `${this.mobs.length} AVAILABLE`,
      {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#94a3b8",
      },
    ).setOrigin(1, 0.5);

    this.root!.add([title, subtitle]);

    if (this.mobs.length === 0) {
      const emptyText = this.scene.add.text(
        width / 2,
        rosterHeight / 2,
        "No attacker types available",
        { fontSize: "16px", color: "#94a3b8" },
      ).setOrigin(0.5);

      this.root!.add(emptyText);
      return;
    }

    const horizontalPadding = padding;
    const gridTop = Math.max(48, rosterHeight * 0.15);
    const gridBottom = Math.max(8, rosterHeight * 0.035);
    const gap = Math.max(8, Math.min(16, width * 0.02));
    const availableWidth = Math.max(1, width - horizontalPadding * 2);
    const availableHeight = Math.max(1, rosterHeight - gridTop - gridBottom);

    // Choose columns from available width, then fit the resulting rows vertically.
    const minCardWidth = 112;
    const columns = Math.max(
      1,
      Math.min(
        this.mobs.length,
        Math.floor((availableWidth + gap) / (minCardWidth + gap)),
      ),
    );
    const rows = Math.ceil(this.mobs.length / columns);

    const cardWidth = Math.min(
      176,
      (availableWidth - gap * (columns - 1)) / columns,
    );
    const cardHeight = Math.min(
      232,
      (availableHeight - gap * (rows - 1)) / rows,
      cardWidth * 1.28,
    );

    const gridWidth = columns * cardWidth + (columns - 1) * gap;
    const startX = Math.max(0, (width - gridWidth) / 2);
    const usedGridHeight = rows * cardHeight + (rows - 1) * gap;
    const startY = gridTop + Math.max(0, (availableHeight - usedGridHeight) / 2);

    this.mobs.forEach((mob, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      const card = new MobCard(
        this.scene,
        x,
        y,
        cardWidth,
        cardHeight,
        mob,
        (selectedMob) => this.toggleMob(selectedMob),
        (selectedMob) => this.showDetails(selectedMob),
      );

      this.cards.push(card);
      this.root!.add(card.container);
    });
  }

  /**
   * Creates the selected-deck strip and confirm button in the lower panel.
   *
   * @param width - Current canvas width.
   * @param rosterHeight - Y coordinate where the lower panel begins.
   * @param deckHeight - Height of the lower panel.
   */
  private createDeckPanel(
    width: number,
    rosterHeight: number,
    deckHeight: number,
  ): void {
    const padding = Math.max(12, Math.min(24, width * 0.03));
    const compact = width < 440;
    const headingSize = compact ? 14 : 17;
    const buttonWidth = Math.min(compact ? 112 : 148, width * 0.34);
    const buttonHeight = Math.max(34, Math.min(44, deckHeight * 0.28));

    const heading = this.scene.add.text(
      padding,
      rosterHeight + 18,
      "YOUR DECK",
      {
        fontSize: `${headingSize}px`,
        fontStyle: "bold",
        color: "#f8fafc",
      },
    ).setOrigin(0, 0.5);

    this.countText = this.scene.add.text(
      padding + (compact ? 92 : 116),
      rosterHeight + 18,
      "",
      { fontSize: "12px", color: "#94a3b8" },
    ).setOrigin(0, 0.5);

    this.selectedContainer = this.scene.add.container(padding, rosterHeight + 50);

    const buttonX = width - padding - buttonWidth;
    const buttonY = rosterHeight + deckHeight / 2 + 8;

    this.confirmButton = new UIButton({
      scene: this.scene,
      x: buttonX + buttonWidth / 2,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      label: "CONFIRM",
      fontSize: compact ? 11 : 13,
      onClick: () => this.confirmDraft(),
    });

    this.root!.add([
      heading,
      this.countText,
      this.selectedContainer,
      this.confirmButton.container,
    ]);
  }

  /**
 * Unlocks the draft after the server rejects a submission.
 *
 * @remarks
 * Preserves the player's selections so they can correct and retry.
 */
rejectDraft(reason: string): void {
  this.confirmed = false;
  this.refreshSelection();
  console.warn("Draft rejected:", reason);
}

  /**
   * Adds or removes a unique mob type from the local draft.
   *
   * @param mob - Catalog entry the player clicked.
   */
  private toggleMob(mob: MobType): void {
    if (this.confirmed) {
      this.confirmed = false;
    }

    if (this.selected.has(mob.id)) {
      this.selected.delete(mob.id);
    } else {
      if (this.selected.size >= this.maxSelections) {
        this.scene.cameras.main.shake(100, 0.002);
        return;
      }

      this.selected.add(mob.id);
    }

    this.refreshSelection();
  }

  /** Synchronizes card borders, the selected portrait strip, and button state. */
  private refreshSelection(): void {
    for (const card of this.cards) {
      card.setSelected(this.selected.has(card.mob.id));
    }

    this.countText?.setText(`${this.selected.size}/${this.maxSelections} SELECTED`);

    this.selectedContainer?.removeAll(true);

    const width = this.scene.scale.width;
    const rosterHeight = Math.floor(this.scene.scale.height * 0.7);
    const deckHeight = this.scene.scale.height - rosterHeight;
    const padding = Math.max(12, Math.min(24, width * 0.03));
    const maxStripWidth = Math.max(40, width - padding * 2 - 168);
    const gap = 10;
    const cardHeight = Math.max(60, Math.min(150, deckHeight - 72));
    const cardWidth = Math.min(
      cardHeight * 0.72,
      (maxStripWidth - gap * Math.max(0, this.maxSelections - 1)) /
        Math.max(1, this.maxSelections),
    );
    const selectedMobs = this.mobs.filter((mob) => this.selected.has(mob.id));

    selectedMobs.forEach((mob, index) => {
      const card = new MobCard(
        this.scene,
        index * (cardWidth + gap),
        0,
        cardWidth,
        cardHeight,
        mob,
        (selectedMob) => this.toggleMob(selectedMob),
      );

      card.setSelected(true);
      this.selectedContainer?.add(card.container);
    });

    const canConfirm = this.selected.size > 0 && !this.confirmed;

    this.confirmButton?.setEnabled(canConfirm);
    this.confirmButton?.setLabel(this.confirmed ? "CONFIRMED" : "CONFIRM");
  }

  /**
   * Displays mob stats in a modal without changing selection.
   *
   * @param mob - Catalog entry whose details should be inspected.
   */
  private showDetails(mob: MobType): void {
    this.detailsOverlay?.destroy(true);

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const panelWidth = Math.min(360, width - 32);
    const panelHeight = Math.min(300, height - 32);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    const overlay = this.scene.add.container(0, 0);
    this.detailsOverlay = overlay;

    const shade = this.scene.add
      .rectangle(0, 0, width, height, 0x020617, 0.82)
      .setOrigin(0, 0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );

    shade.on("pointerdown", () => {
      this.closeDetails();
    });

    const panel = this.scene.add
      .image(width / 2, height / 2, UI_TEXTURE_KEY, "panel")
      .setDisplaySize(panelWidth, panelHeight);

    const panelHit = this.scene.add
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x000000, 0)
      .setInteractive(
        new Phaser.Geom.Rectangle(
          -panelWidth / 2,
          -panelHeight / 2,
          panelWidth,
          panelHeight,
        ),
        Phaser.Geom.Rectangle.Contains,
      );

    // Keep clicks inside the panel from reaching the backdrop.
    panelHit.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
      event.stopPropagation();
    });

    const marginX = panelX + panelWidth * 0.09;
    const titleY = panelY + panelHeight * 0.15;
    const closeX = panelX + panelWidth * 0.88;

    const title = this.scene.add.text(marginX, titleY, mob.name, {
      fontSize: "24px",
      fontStyle: "bold",
      color: "#2b1a08",
    });

    const stats = this.scene.add.text(
      marginX,
      panelY + panelHeight * 0.42,
      `HEALTH     ${mob.maxHp}\nSPEED       ${mob.speed}\nBOUNTY    ${mob.bounty}`,
      {
        fontSize: "16px",
        color: "#3d2a16",
        lineSpacing: 12,
      },
    );

    const note = this.scene.add.text(
      marginX,
      panelY + panelHeight * 0.84,
      "Bounty is earned when this unit is defeated.",
      {
        fontSize: "11px",
        color: "#5f3f22",
        wordWrap: { width: panelWidth - 44 },
      },
    );

    const closeButton = this.scene.add
      .rectangle(closeX, titleY + 14, 32, 32, 0x334155)
      .setInteractive(
        new Phaser.Geom.Rectangle(-16, -16, 32, 32),
        Phaser.Geom.Rectangle.Contains,
      );

    const closeLabel = this.scene.add
      .text(closeX, titleY + 14, "×", {
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    closeButton.on("pointerdown", () => this.closeDetails());

    overlay.add([
      shade,
      panel,
      panelHit,
      title,
      stats,
      note,
      closeButton,
      closeLabel,
    ]);

    // Render the modal above the roster and selected-deck panel.
    this.root?.add(overlay);
  }

  /** Closes the details modal without changing the current draft. */
  private closeDetails(): void {
    this.detailsOverlay?.destroy(true);
    this.detailsOverlay = undefined;
  }

 
    /**
     * Submits the current selection to the server.
     *
     * @remarks
     * The server validates the deck and advances the phase only when both
     * players have confirmed. This stage does not change RoomState directly.
     */
    private confirmDraft(): void {
    if (this.confirmed || this.selected.size === 0) {
        return;
    }

    const intent: DraftReadyIntent = {
        deck: [...this.selected],
    };

    this.confirmed = true;
    this.refreshSelection();

    this.onConfirm(intent.deck);
    }
/**
 * Unsubscribes from resize events and releases stage-owned display objects.
 */
destroy(): void {
  this.scene.scale.off(
    Phaser.Scale.Events.RESIZE,
    this.handleResize,
  );

  this.root?.destroy(true);
  this.root = undefined;
  this.detailsOverlay = undefined;
  this.selectedContainer = undefined;
  this.cards = [];
  this.selected.clear();
}
}
