// Voortgangs-types (SPEC §5 Cat 1 + §8). Voortgang leeft in Firestore, gesleuteld op
// naam-slug (SPEC §9). Content blijft statisch; hier staat alleen wat de gebruiker doet.

/** Leitner-bakje 1..5 (SPEC §5: 1 = elke sessie ... 5 = ~klaar). */
export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

/** Persistente voortgang van één Cat 1-item voor één gebruiker. */
export interface ItemProgress {
  itemId: string;
  box: LeitnerBox;
  /** ISO-datum (YYYY-MM-DD) van de laatste keer dat dit item aan de beurt was. */
  laatstGezien: string;
  aantalGoed: number;
  aantalFout: number;
}

/** Uitkomst van één antwoord-poging binnen een sessie. */
export type Uitkomst = "goed" | "fout" | "bijna";

/**
 * Resultaat van één afgerond trainer-blok — append-only bron-van-waarheid (SPEC §8, v0.1-core).
 * Punten/streaks/mijlpalen zijn een afgeleide view híerover (fase 2).
 */
export interface BlokResultaat {
  /** ISO-timestamp van afronding. */
  afgerondOp: string;
  vak: string;
  categorie: 1 | 2 | 3 | 4;
  /** Items/vragen die aan bod kwamen. */
  aantalItems: number;
  aantalGoed: number;
  aantalFout: number;
  /** Mastery na dit blok: fractie items in box 3+ (0..1). */
  masteryNa: number;
  /** Bestede tijd in seconden (voor pacing-flags, SPEC §7). */
  duurSec: number;
}
