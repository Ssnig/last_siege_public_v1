export const DRAFT_RULES = {
  PICKS_PER_TURN: 2,
  MAX_CARDS_PER_PLAYER: 6,
  ALLOW_DUPLICATES: false,
  TURN_DURATION_SECONDS: 30,
  FIRST_PICKER: "attacker" as "attacker" | "defender",
  AUTO_PICK_ON_TIMEOUT: true,
} as const;

export type DraftRole = "attacker" | "defender";

export function getTotalDraftTurns(): number {
  return (
    Math.ceil(
      DRAFT_RULES.MAX_CARDS_PER_PLAYER /
        DRAFT_RULES.PICKS_PER_TURN,
    ) * 2
  );
}

export function getDraftRole(turn: number): DraftRole {
  const first = DRAFT_RULES.FIRST_PICKER;

  return turn % 2 === 0
    ? first
    : first === "attacker"
      ? "defender"
      : "attacker";
}

export function getRemainingCapacity(
  deckSize: number,
): number {
  return Math.max(
    0,
    DRAFT_RULES.MAX_CARDS_PER_PLAYER - deckSize,
  );
}

export function getPicksForTurn(
  deckSize: number,
): number {
  return Math.min(
    DRAFT_RULES.PICKS_PER_TURN,
    getRemainingCapacity(deckSize),
  );
}

export function canPickCard(
  cardId: string,
  deck: readonly string[],
): boolean {
  if (getRemainingCapacity(deck.length) === 0) {
    return false;
  }

  if (
    !DRAFT_RULES.ALLOW_DUPLICATES &&
    deck.includes(cardId)
  ) {
    return false;
  }

  return true;
}