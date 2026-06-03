import type { ItemProgress, LeitnerBox, Uitkomst } from "@pww/shared";

/** Herhaalinterval in dagen per bakje (SPEC §5 Cat 1). Bakje 1 = elke sessie. */
export const LEITNER_INTERVAL_DAGEN: Record<LeitnerBox, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 7,
  5: 14,
};

/** Een item geldt als "geleerd genoeg" voor mastery vanaf bakje 3. */
export const MASTERY_BOX_DREMPEL: LeitnerBox = 3;

/** Verschil in hele dagen tussen twee ISO-datums (YYYY-MM-DD). */
export function daysBetween(vanaf: string, tot: string): number {
  const a = Date.parse(`${vanaf}T00:00:00Z`);
  const b = Date.parse(`${tot}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Is dit item vandaag aan de beurt volgens zijn bakje-interval? */
export function isDue(progress: ItemProgress, vandaag: string): boolean {
  const interval = LEITNER_INTERVAL_DAGEN[progress.box];
  return daysBetween(progress.laatstGezien, vandaag) >= interval;
}

function promote(box: LeitnerBox): LeitnerBox {
  return Math.min(box + 1, 5) as LeitnerBox;
}

/**
 * Pas één antwoord-uitkomst toe op de persistente voortgang van een item.
 * Goed → bakje +1; fout én "bijna" → terug naar bakje 1 (SPEC: "bijna" geldt als fout).
 */
export function applyResult(
  progress: ItemProgress,
  uitkomst: Uitkomst,
  vandaag: string,
): ItemProgress {
  const goed = uitkomst === "goed";
  return {
    ...progress,
    box: goed ? promote(progress.box) : 1,
    laatstGezien: vandaag,
    aantalGoed: progress.aantalGoed + (goed ? 1 : 0),
    aantalFout: progress.aantalFout + (goed ? 0 : 1),
  };
}

/** Verse voortgang voor een nog niet eerder gezien item. */
export function nieuwItem(itemId: string, vandaag: string): ItemProgress {
  return { itemId, box: 1, laatstGezien: vandaag, aantalGoed: 0, aantalFout: 0 };
}

/** Mastery van een vak/onderwerp: fractie items in bakje 3+ (0..1). */
export function mastery(items: readonly ItemProgress[]): number {
  if (items.length === 0) return 0;
  const geleerd = items.filter((i) => i.box >= MASTERY_BOX_DREMPEL).length;
  return geleerd / items.length;
}
