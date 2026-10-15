
import Phaser from "phaser";
import {
  DEFAULT_DECK_RULES,
  MOB_TYPES,
  type DraftReadyIntent,
  type MobType,
} from "@root/shared";
import { MobCard } from "../ui/MobCard";


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
  private confirmBackground?: Phaser.GameObjects.Rectangle;
  private confirmText?: Phaser.GameObjects.Text;

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

<<<<<<< HEAD
  private readonly scene: Phaser.Scene;

  /**
   * @param scene - Active Phaser scene that owns this stage's UI.
   * @param onConfirm - Sends the selected deck to the server.
   */
  constructor(
    scene: Phaser.Scene,
    onConfirm: (deck: string[]) => void,
  ) {
=======
    /**
     * @param scene - Active Phaser scene that owns this stage's UI.
     * @param onConfirm - Sends the selected deck to the server.
     */
  constructor(scene: Phaser.Scene, onConfirm: (deck: string[]) => void) {
>>>>>>> main
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

    const background = this.scene.add.rectangle(
      0,
      0,
      width,
      height,
      0x0b1120,
    ).setOrigin(0, 0);

    const rosterBackground = this.scene.add.rectangle(
      0,
      0,
      width,
      rosterHeight,
      0x111827,
    ).setOrigin(0, 0);

    const deckBackground = this.scene.add.rectangle(
      0,
      rosterHeight,
      width,
      deckHeight,
      0x0f172a,
    ).setOrigin(0, 0).setStrokeStyle(1, 0x334155);

    this.root.add([background, rosterBackground, deckBackground]);

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

    this.selectedContainer = this.scene.add.container(
      padding,
      rosterHeight + Math.max(42, deckHeight * 0.36),
    );

    const buttonX = width - padding - buttonWidth;
    const buttonY = rosterHeight + deckHeight / 2 + 8;

    this.confirmBackground = this.scene.add
      .rectangle(
        buttonX + buttonWidth / 2,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x4f46e5,
      )
      .setStrokeStyle(1, 0x818cf8)
      .setInteractive(
        new Phaser.Geom.Rectangle(
          -buttonWidth / 2,
          -buttonHeight / 2,
          buttonWidth,
          buttonHeight,
        ),
        Phaser.Geom.Rectangle.Contains,
      );

    this.confirmText = this.scene.add
      .text(buttonX + buttonWidth / 2, buttonY, "CONFIRM", {
        fontSize: compact ? "11px" : "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.confirmBackground.on("pointerover", () => {
      if (!this.confirmed && this.selected.size > 0) {
        this.confirmBackground?.setFillStyle(0x6366f1);
      }
    });

    this.confirmBackground.on("pointerout", () => this.refreshSelection());

    this.confirmBackground.on("pointerdown", () => this.confirmDraft());

    this.root!.add([
      heading,
      this.countText,
      this.selectedContainer,
      this.confirmBackground,
      this.confirmText,
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
    const compact = width < 440;
    const maxStripWidth = Math.max(40, width - (compact ? 148 : 196));
    const gap = 8;
    const slotWidth = Math.max(
      42,
      Math.min(76, (maxStripWidth - gap * Math.max(0, this.maxSelections - 1)) /
        Math.max(1, this.maxSelections)),
    );
    const slotHeight = Math.max(42, Math.min(70, deckHeight - 52));
    const selectedMobs = this.mobs.filter((mob) => this.selected.has(mob.id));

    selectedMobs.forEach((mob, index) => {
      const x = index * (slotWidth + gap);

      const tile = this.scene.add
        .rectangle(x, 0, slotWidth, slotHeight, 0x1e293b)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x4ade80);

      const textureKey = `mob-${mob.id}`;

      if (this.scene.textures.exists(textureKey)) {
        const sprite = this.scene.add
          .image(x + slotWidth / 2, slotHeight * 0.38, textureKey)
          .setDisplaySize(slotWidth * 0.56, slotHeight * 0.48);

        this.selectedContainer?.add(sprite);
      } else {
        const color = this.getMobColor(mob.id);
        const icon = this.scene.add.circle(
          x + slotWidth / 2,
          slotHeight * 0.38,
          Math.max(7, Math.min(15, slotWidth * 0.18)),
          color,
        );

        this.selectedContainer?.add(icon);
      }

      const label = this.scene.add.text(
        x + slotWidth / 2,
        slotHeight - 9,
        mob.name,
        {
          fontSize: `${Math.max(8, Math.min(11, slotWidth * 0.15))}px`,
          color: "#e2e8f0",
          align: "center",
          wordWrap: { width: slotWidth - 4 },
        },
      ).setOrigin(0.5);

      this.selectedContainer?.add([tile, label]);
    });

    const canConfirm = this.selected.size > 0 && !this.confirmed;

    this.confirmBackground
      ?.setFillStyle(canConfirm ? 0x4f46e5 : 0x334155)
      .setStrokeStyle(1, canConfirm ? 0x818cf8 : 0x475569);

    this.confirmText?.setText(
      this.confirmed ? "CONFIRMED" : "CONFIRM",
    ).setColor(canConfirm || this.confirmed ? "#ffffff" : "#94a3b8");
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
      .rectangle(
        width / 2,
        height / 2,
        panelWidth,
        panelHeight,
        0x172033,
      )
      .setStrokeStyle(2, 0x6366f1)
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
    panel.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
      event.stopPropagation();
    });

    const title = this.scene.add.text(
      panelX + 22,
      panelY + 28,
      mob.name,
      {
        fontSize: "24px",
        fontStyle: "bold",
        color: "#f8fafc",
      },
    );

    const stats = this.scene.add.text(
      panelX + 22,
      panelY + 82,
      `HEALTH     ${mob.maxHp}\nSPEED       ${mob.speed}\nBOUNTY    ${mob.bounty}`,
      {
        fontSize: "16px",
        color: "#cbd5e1",
        lineSpacing: 12,
      },
    );

    const note = this.scene.add.text(
      panelX + 22,
      panelY + panelHeight - 64,
      "Bounty is earned when this unit is defeated.",
      {
        fontSize: "11px",
        color: "#94a3b8",
        wordWrap: { width: panelWidth - 44 },
      },
    );

    const closeButton = this.scene.add
      .rectangle(
        panelX + panelWidth - 30,
        panelY + 28,
        32,
        32,
        0x334155,
      )
      .setInteractive(
        new Phaser.Geom.Rectangle(-16, -16, 32, 32),
        Phaser.Geom.Rectangle.Contains,
      );

    const closeLabel = this.scene.add
      .text(panelX + panelWidth - 30, panelY + 28, "×", {
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    closeButton.on("pointerdown", () => this.closeDetails());

    overlay.add([
      shade,
      panel,
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
   * Returns the fallback portrait color used before real mob art is loaded.
   *
   * @param id - Stable mob catalog ID.
   * @returns Hexadecimal placeholder color.
   */
  private getMobColor(id: string): number {
    const colors: Record<string, number> = {
      grunt: 0x60a5fa,
      runner: 0xfbbf24,
      brute: 0xf87171,
    };

    return colors[id] ?? 0xa78bfa;
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
