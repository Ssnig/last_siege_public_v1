
import Phaser from "phaser";
import {
  DEFAULT_DECK_RULES,
  TOWER_TYPES,
  type DraftReadyIntent,
  type TowerType,
} from "@root/shared";
import { TowerCard } from "../ui/TowerCard";
import { UIButton } from "../ui/UIButton";
import {
  UI_BG_FRAMES,
  UI_BG_TEXTURE_KEY,
  UI_TEXTURE_KEY,
} from "../ui/uiAtlas";

/**
 * Client-side draft UI for the defender's tower deck.
 *
 * @remarks
 * The top 70% displays available towers; the bottom 30% displays selected
 * towers and confirmation. Selection is unique by tower ID and is capped at
 * the smaller of the shared deck-size rule and the available catalog size.
 *
 * **Authority boundary:** tower cost is displayed as information only.
 * Drafting does not deduct gold, place towers, or modify Colyseus state.
 * The current confirm action logs a local payload for future server wiring.
 */
export class DefenderDraftStage {
    /**
 * Submits the selected tower IDs through the scene's network layer.
 *
 * @remarks
 * The stage owns UI state, not the Colyseus connection.
 */
private readonly onConfirm: (deck: string[]) => void;
  private readonly scene: Phaser.Scene;
  private root?: Phaser.GameObjects.Container;
  private cards: TowerCard[] = [];
  private selected = new Set<string>();
  private selectedContainer?: Phaser.GameObjects.Container;
  private countText?: Phaser.GameObjects.Text;
  private confirmButton?: UIButton;
  private detailsOverlay?: Phaser.GameObjects.Container;
  private confirmed = false;

  private readonly towers: TowerType[] = Object.values(TOWER_TYPES);
  private readonly maxSelections = Math.min(
    DEFAULT_DECK_RULES.deckSize,
    Object.keys(TOWER_TYPES).length,
  );

  /** Stable callback reference for removing the resize listener. */
  private readonly handleResize = (): void => this.render();


  /**
   * @param scene - Active Phaser scene that owns the draft UI.
   * @param onConfirm - Callback for submitting the selected tower deck.
   */
  constructor(scene: Phaser.Scene, onConfirm: (deck: string[]) => void) {
    this.scene = scene;
    this.onConfirm = onConfirm;
  }

  /** Creates the draft UI and registers responsive layout handling. */
  create(): void {
    this.render();
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  /**
   * Rebuilds the stage at the current canvas size.
   *
   * @remarks Selection survives resize; transient detail popups are dismissed.
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

    this.root.add([
      // Flat dark fill sits behind the art so its transparent margins never
      // expose the canvas clear colour.
      this.scene.add.rectangle(0, 0, width, height, 0x3e2723).setOrigin(0),
      this.scene.add
        .image(0, 0, UI_BG_TEXTURE_KEY, UI_BG_FRAMES.bg1)
        .setOrigin(0, 0)
        .setDisplaySize(width, height),
      this.scene.add
        .rectangle(0, rosterHeight, width, deckHeight, 0x0b1120, 0.4)
        .setOrigin(0)
        .setStrokeStyle(1, 0x334155),
    ]);

    this.createRoster(width, rosterHeight);
    this.createDeckPanel(width, rosterHeight, deckHeight);
    this.refreshSelection();
  }

  /**
   * Creates the tower heading and adaptive portrait grid.
   *
   * @param width - Canvas width.
   * @param rosterHeight - Height allocated to the roster.
   */
  private createRoster(width: number, rosterHeight: number): void {
    const padding = Math.max(12, Math.min(24, width * 0.03));

    // Opaque header strip keeps the roster heading legible over the bg art.
    const headerHeight = Math.max(44, Math.min(58, rosterHeight * 0.12));
    const headerBar = this.scene.add
      .rectangle(0, 0, width, headerHeight, 0x0b1120, 0.8)
      .setOrigin(0, 0);
    const headerRule = this.scene.add
      .rectangle(0, headerHeight, width, 2, 0x475569, 0.9)
      .setOrigin(0, 0);

    this.root!.add([headerBar, headerRule]);

    const title = this.scene.add.text(padding, 24, "DEFENDER TOWERS", {
      fontSize: `${Math.max(17, Math.min(24, width * 0.035))}px`,
      fontStyle: "bold",
      color: "#f8fafc",
    }).setOrigin(0, 0.5);

    const available = this.scene.add.text(
      width - padding,
      24,
      `${this.towers.length} AVAILABLE`,
      { fontSize: "12px", fontStyle: "bold", color: "#94a3b8" },
    ).setOrigin(1, 0.5);

    this.root!.add([title, available]);

    if (this.towers.length === 0) {
      this.root!.add(
        this.scene.add.text(
          width / 2,
          rosterHeight / 2,
          "No tower types available",
          { fontSize: "16px", color: "#94a3b8" },
        ).setOrigin(0.5),
      );
      return;
    }

    const gap = Math.max(8, Math.min(16, width * 0.02));
    const availableWidth = Math.max(1, width - padding * 2);
    const gridTop = Math.max(48, rosterHeight * 0.15);
    const availableHeight = Math.max(1, rosterHeight - gridTop - 12);

    const columns = Math.max(
      1,
      Math.min(
        this.towers.length,
        Math.floor((availableWidth + gap) / (112 + gap)),
      ),
    );
    const rows = Math.ceil(this.towers.length / columns);
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
    const gridHeight = rows * cardHeight + (rows - 1) * gap;
    const startY = gridTop + Math.max(0, (availableHeight - gridHeight) / 2);

    this.towers.forEach((tower, index) => {
      const x = startX + (index % columns) * (cardWidth + gap);
      const y = startY + Math.floor(index / columns) * (cardHeight + gap);

      const card = new TowerCard(
        this.scene,
        x,
        y,
        cardWidth,
        cardHeight,
        tower,
        (selectedTower) => this.toggleTower(selectedTower),
        (infoTower) => this.showDetails(infoTower),
      );

      this.cards.push(card);
      this.root!.add(card.container);
    });
  }

  /**
   * Creates the selected tower strip and local confirmation button.
   *
   * @param width - Canvas width.
   * @param rosterHeight - Y coordinate where the lower panel starts.
   * @param deckHeight - Height of the lower panel.
   */
  private createDeckPanel(
    width: number,
    rosterHeight: number,
    deckHeight: number,
  ): void {
    const padding = Math.max(12, Math.min(24, width * 0.03));
    const compact = width < 440;
    const buttonWidth = Math.min(compact ? 112 : 148, width * 0.34);
    const buttonHeight = Math.max(34, Math.min(44, deckHeight * 0.28));

    const heading = this.scene.add.text(
      padding,
      rosterHeight + 18,
      "YOUR TOWER DECK",
      {
        fontSize: compact ? "14px" : "17px",
        fontStyle: "bold",
        color: "#f8fafc",
      },
    ).setOrigin(0, 0.5);

    this.countText = this.scene.add.text(
      padding + (compact ? 132 : 160),
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
   * Adds or removes a tower from the local draft.
   *
   * @param tower - Tower type the player clicked.
   */
  private toggleTower(tower: TowerType): void {
    if (this.selected.has(tower.id)) {
      this.selected.delete(tower.id);
    } else {
      if (this.selected.size >= this.maxSelections) {
        this.scene.cameras.main.shake(100, 0.002);
        return;
      }

      this.selected.add(tower.id);
    }

    this.confirmed = false;
    this.refreshSelection();
  }

  /** Refreshes cards, selected portraits, and confirmation appearance. */
  private refreshSelection(): void {
    this.cards.forEach((card) => {
      card.setSelected(this.selected.has(card.tower.id));
    });

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

    const selectedTowers = this.towers.filter((tower) =>
      this.selected.has(tower.id),
    );

    selectedTowers.forEach((tower, index) => {
      const card = new TowerCard(
        this.scene,
        index * (cardWidth + gap),
        0,
        cardWidth,
        cardHeight,
        tower,
        (selectedTower) => this.toggleTower(selectedTower),
      );

      card.setSelected(true);
      this.selectedContainer?.add(card.container);
    });

    const canConfirm = this.selected.size > 0 && !this.confirmed;

    this.confirmButton?.setEnabled(canConfirm);
    this.confirmButton?.setLabel(this.confirmed ? "CONFIRMED" : "CONFIRM");
  }

  /**
   * Opens tower stats without changing the selection.
   *
   * @param tower - Tower whose stats should be displayed.
   */
  private showDetails(tower: TowerType): void {
    this.closeDetails();

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const panelWidth = Math.min(360, width - 32);
    const panelHeight = Math.min(320, height - 32);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    this.detailsOverlay = this.scene.add.container(0, 0);

    const backdrop = this.scene.add.rectangle(
      0, 0, width, height, 0x020617, 0.82,
    ).setOrigin(0, 0).setInteractive();

    backdrop.on("pointerdown", () => this.closeDetails());

    const panel = this.scene.add
      .image(width / 2, height / 2, UI_TEXTURE_KEY, "panel")
      .setDisplaySize(panelWidth, panelHeight);

    const marginX = panelX + panelWidth * 0.09;
    const titleY = panelY + panelHeight * 0.15;
    const closeX = panelX + panelWidth * 0.88;

    const title = this.scene.add.text(marginX, titleY, tower.name, {
      fontSize: "24px",
      fontStyle: "bold",
      color: "#2b1a08",
    });

    const tier = tower.tiers[0];
    const stats = this.scene.add.text(
      marginX,
      panelY + panelHeight * 0.42,
      [
        `COST                 ${tier?.cost ?? 0} gold`,
        `RANGE               ${tier?.range ?? 0}`,
        `DAMAGE             ${tier?.damage ?? 0}`,
        `FIRE RATE           ${tier?.fireRate ?? 0}/sec`,
        `PROJECTILE SPEED   ${tier?.projectileSpeed ?? 0}`,
      ].join("\n"),
      { fontSize: "14px", color: "#3d2a16", lineSpacing: 8 },
    );

    const closeButton = this.scene.add.rectangle(
      closeX,
      titleY + 14,
      32,
      32,
      0x334155,
    ).setInteractive();

    const closeLabel = this.scene.add.text(
      closeX,
      titleY + 14,
      "×",
      { fontSize: "22px", color: "#ffffff" },
    ).setOrigin(0.5);

    closeButton.on("pointerdown", () => this.closeDetails());

    this.detailsOverlay.add([
      backdrop,
      panel,
      title,
      stats,
      closeButton,
      closeLabel,
    ]);

    this.root?.add(this.detailsOverlay);
  }

  /** Closes the tower details overlay without changing selection. */
  private closeDetails(): void {
    this.detailsOverlay?.destroy(true);
    this.detailsOverlay = undefined;
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
 * Submits the selected tower deck to the server.
 *
 * @remarks
 * The server validates the tower IDs and controls phase transitions.
 * This method does not deduct gold or modify authoritative state.
 */
private confirmDraft(): void {
  if (this.confirmed || this.selected.size === 0) return;

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
