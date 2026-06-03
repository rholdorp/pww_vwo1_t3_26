// Canoniek trainer-content-contract (SPEC §4 Stage 3).
// Dit is het stabiele contract waarop de trainer-engines, validator en web draaien.
// Wijzigingen vereisen SPEC-update + version-bump.

/** Normalisatie-profiel bepaalt hoe een getypt antwoord met het juiste wordt vergeleken (SPEC §5 Cat 1). */
export type NormalisatieProfiel =
  | "frans" // accenten strikt vereist (été ≠ ete); 1-teken-typo → "bijna goed"
  | "engels" // accenten optioneel, getallen exact
  | "begrip" // toleranter: leestekens negeren, lidwoorden optioneel (de cel = cel)
  | "exact"; // letterlijk (jaartallen, topografie)

/** Eén woord-/zinpaar uit een vocab.json (Frans / Engels — Cat 1). */
export interface VocabItem {
  /** Stabiele id: <vak>-h<hoofdstuk>-<onderdeel>-<n>, bv. "frans-h5-phrases-012". */
  id: string;
  /** Nederlandse zijde. */
  nl: string;
  /** Vreemde-taal-zijde (Frans/Engels). */
  vreemd: string;
  /** Optionele context/voorbeeldzin of bron-subkop. */
  context?: string;
  /** Hoofdstuk waaruit dit item komt. */
  hoofdstuk: string;
  /** Extra geaccepteerde vormen van het vreemde antwoord (synoniemen, met/zonder lidwoord). */
  acceptedAnswers?: string[];
  /** Pad naar de raw screenshot waaruit dit item is afgeleid (relatief t.o.v. editie-root). */
  bron: string;
  /** Extractie-confidence 0..1 (review-trigger onder drempel, SPEC §4). */
  confidence: number;
}

/** Bestand content/<editie>/trainers/<vak>/vocab.json. */
export interface VocabBestand {
  vak: string;
  hoofdstuk: string;
  /** Welke richting(en) getraind worden. */
  richtingen: Richting[];
  /** Normalisatie-profiel voor het vreemde antwoord. */
  normalisatie: NormalisatieProfiel;
  items: VocabItem[];
}

/** Vraagrichting voor een Cat 1-item. */
export type Richting = "nl->vreemd" | "vreemd->nl";
