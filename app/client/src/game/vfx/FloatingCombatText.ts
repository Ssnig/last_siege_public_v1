import Phaser from "phaser";

export type StatusAlertVariant =
  | "status_stun"
  | "status_silence"
  | "status_armor_crush"
  | "status_armor_stack"
  | "status_mental_stack"
  | "status_speed_burst"
  | "status_speed_broken"
  | "status_drench"
  | "status_bleed"
  | "status_exhausted"
  | "status_bounty"
  | "status_breach";

interface TextStyleConfig {
  color: string;
  stroke: string;
  strokeThickness: number;
  fontSize: string;
  fontStyle: string;
  defaultText?: string;
  isCrit?: boolean;
}

const STYLES: Record<
  "damage_physical" | "damage_mental" | "damage_crit" | "heal" | StatusAlertVariant,
  TextStyleConfig
> = {
  damage_physical: {
    color: "#fbbf24", // Vibrant amber
    stroke: "#451a03", // Deep burnt bronze
    strokeThickness: 3.5,
    fontSize: "15px",
    fontStyle: "bold",
  },
  damage_mental: {
    color: "#e879f9", // Mystic fuchsia / violet
    stroke: "#3b0764", // Deep purple
    strokeThickness: 3.5,
    fontSize: "15px",
    fontStyle: "bold",
  },
  damage_crit: {
    color: "#ef4444", // Bright red
    stroke: "#450a0a", // Blood maroon
    strokeThickness: 4,
    fontSize: "18px",
    fontStyle: "900",
    isCrit: true,
  },
  heal: {
    color: "#34d399", // Emerald green
    stroke: "#064e3b", // Deep forest green
    strokeThickness: 3.5,
    fontSize: "15px",
    fontStyle: "bold",
  },
  status_stun: {
    color: "#fef08a",
    stroke: "#713f12",
    strokeThickness: 3.5,
    fontSize: "12px",
    fontStyle: "800",
    defaultText: "STUNNED!",
  },
  status_silence: {
    color: "#e9d5ff",
    stroke: "#581c87",
    strokeThickness: 3.5,
    fontSize: "12px",
    fontStyle: "800",
    defaultText: "SILENCED!",
  },
  status_armor_crush: {
    color: "#fdba74",
    stroke: "#7c2d12",
    strokeThickness: 3.5,
    fontSize: "12px",
    fontStyle: "800",
    defaultText: "ARMOR CRUSH!",
  },
  status_armor_stack: {
    color: "#fde047",
    stroke: "#713f12",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "+ARMOR",
  },
  status_mental_stack: {
    color: "#d8b4fe",
    stroke: "#4a044e",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "+RESOLVE",
  },
  status_speed_burst: {
    color: "#a7f3d0",
    stroke: "#064e3b",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "SPEED BURST!",
  },
  status_speed_broken: {
    color: "#fca5a5",
    stroke: "#7f1d1d",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "BURST BROKEN",
  },
  status_drench: {
    color: "#67e8f9",
    stroke: "#164e63",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "DRENCHED!",
  },
  status_bleed: {
    color: "#f87171",
    stroke: "#7f1d1d",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "BLEED!",
  },
  status_exhausted: {
    color: "#f87171",
    stroke: "#450a0a",
    strokeThickness: 3,
    fontSize: "11px",
    fontStyle: "bold",
    defaultText: "EXHAUSTED",
  },
  status_bounty: {
    color: "#fef08a",
    stroke: "#78350f",
    strokeThickness: 3.5,
    fontSize: "12px",
    fontStyle: "900",
    defaultText: "+BONUS GOLD",
  },
  status_breach: {
    color: "#f87171",
    stroke: "#450a0a",
    strokeThickness: 4,
    fontSize: "15px",
    fontStyle: "900",
    defaultText: "CORE BREACH!",
  },
};

/**
 * Manages floating combat damage numbers, healing, and status alerts.
 */
export class FloatingCombatTextManager {
  /**
   * Spawns a floating combat damage number.
   */
  public static spawnDamage(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    damage: number,
    damageType: "physical" | "mental",
    isCrit?: boolean,
  ): void {
    if (!scene || damage <= 0) return;

    const variantKey = isCrit
      ? "damage_crit"
      : damageType === "mental"
        ? "damage_mental"
        : "damage_physical";
    const style = STYLES[variantKey];
    const displayText = isCrit ? `-${damage}!` : `-${damage}`;

    this.createAndAnimateText(scene, container, x, y, displayText, style, isCrit);
  }

  /**
   * Spawns a floating healing number.
   */
  public static spawnHeal(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    amount: number,
  ): void {
    if (!scene || amount <= 0) return;

    const style = STYLES.heal;
    const displayText = `+${amount}`;

    this.createAndAnimateText(scene, container, x, y, displayText, style, false);
  }

  /**
   * Spawns a floating status alert badge (e.g. STUNNED!, +ARMOR, SILENCED!).
   */
  public static spawnStatus(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    variant: StatusAlertVariant,
    customText?: string,
  ): void {
    if (!scene) return;

    const style = STYLES[variant];
    const displayText = customText || style.defaultText || "STATUS";

    this.createAndAnimateText(scene, container, x, y, displayText, style, false, 0.9);
  }

  /**
   * Internal helper to create the text object, apply styling, and tween it.
   */
  private static createAndAnimateText(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    style: TextStyleConfig,
    isCrit: boolean = false,
    baseScale: number = 1.0,
  ): void {
    // Random horizontal jitter so rapid consecutive numbers fan out
    const jitterX = Phaser.Math.Between(-14, 14);
    const startX = x + jitterX;
    const startY = y - 18;

    const textObj = scene.add
      .text(startX, startY, text, {
        fontFamily: "'MedievalSharp', 'Cinzel', 'Trebuchet MS', sans-serif",
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
        color: style.color,
        stroke: style.stroke,
        strokeThickness: style.strokeThickness,
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScale(baseScale * 0.5)
      .setDepth(25);

    container.add(textObj);

    const targetPeakScale = isCrit ? baseScale * 1.45 : baseScale * 1.2;
    const targetEndScale = isCrit ? baseScale * 1.15 : baseScale * 1.0;
    const floatDistance = isCrit ? 48 : 38;
    const duration = isCrit ? 900 : 750;

    // Phase 1: Spring pop scale
    scene.tweens.add({
      targets: textObj,
      scale: targetPeakScale,
      duration: 80,
      ease: "Sine.easeOut",
      onComplete: () => {
        if (!textObj.active) return;
        scene.tweens.add({
          targets: textObj,
          scale: targetEndScale,
          duration: 90,
          ease: "Sine.easeIn",
        });
      },
    });

    // Phase 2: Upward float motion
    scene.tweens.add({
      targets: textObj,
      y: startY - floatDistance,
      duration,
      ease: "Cubic.easeOut",
    });

    // Phase 3: Delayed smooth fadeout
    scene.tweens.add({
      targets: textObj,
      alpha: 0,
      delay: duration * 0.45,
      duration: duration * 0.55,
      ease: "Linear",
      onComplete: () => {
        textObj.destroy();
      },
    });
  }
}
