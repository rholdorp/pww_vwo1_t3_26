// Validator-types (SPEC §6). Een "fact" is de kleinste verifieerbare eenheid: voor Cat 1
// een woord-/zinpaar. De validator vergelijkt facts uit trainer-content met facts die een
// vision-model onafhankelijk uit de raw screenshots haalt.

/** Eén verifieerbaar feit, genormaliseerd voor vergelijking. */
export interface Fact {
  /** Identiteit/prompt-zijde, genormaliseerd (bv. de NL-kant van een vocab-paar). */
  key: string;
  /** Antwoord-/waarde-zijde, genormaliseerd (bv. de vreemde-taal-kant). */
  value: string;
  /** Originele, ongenormaliseerde tekst — voor leesbare rapporten. */
  bronKey: string;
  bronValue: string;
  /** Trainer-item-id indien bekend (alleen voor trainer-facts). */
  id?: string;
  /** Raw screenshot-pad waaruit dit feit komt. */
  bron?: string;
}

/** Een gekoppeld paar (zelfde item in beide sets). */
export interface FactPaar {
  trainer: Fact;
  raw: Fact;
  /** Sleutel-overeenkomst 0..1 (1 = identieke genormaliseerde sleutel). */
  gelijkenis: number;
}

/** Resultaat van de bidirectionele vergelijking (SPEC §6 stap 3). */
export interface CompareResult {
  /** In raw, niet in trainer → gevaarlijk: gemiste stof. */
  missing: Fact[];
  /** In trainer, niet in raw → verzonnen. */
  hallucinated: Fact[];
  /** Zelfde sleutel, andere waarde (bv. verkeerde vertaling). */
  mismatches: FactPaar[];
  /** Correct gekoppeld én gelijke waarde. */
  matched: FactPaar[];
}

/** Strengheidsmodus per content-type (SPEC §6). */
export type Strengheid = "strikt" | "soft";

/** Eindoordeel per vak. */
export interface Verdict {
  vak: string;
  strengheid: Strengheid;
  pass: boolean;
  /** Harde fouten die publiceren blokkeren. */
  fouten: string[];
  /** Waarschuwingen (publiceren mag, wel loggen voor review). */
  warnings: string[];
}
