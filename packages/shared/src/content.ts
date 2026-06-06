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
  /**
   * Optioneel grammaticaal vorm-label (bv. "vrouwelijk", "mannelijk meervoud").
   * Wordt in de richting nl->vreemd áchter de NL-prompt getoond om te tonen wélke
   * vorm gevraagd wordt; het is nooit deel van het te typen antwoord. Bij
   * vreemd->nl typt Stijn de kale `nl`-betekenis (bv. "mooi", niet "mooi (vrouwelijk)").
   */
  vorm?: string;
  /** Optionele context/voorbeeldzin of bron-subkop. */
  context?: string;
  /** Hoofdstuk waaruit dit item komt. */
  hoofdstuk: string;
  /**
   * Extra geaccepteerde antwoorden (synoniemen, met/zonder lidwoord).
   * - `string[]`: vormen van het **vreemde** antwoord (legacy; gebruikt in nl->vreemd).
   * - `{ nl?, vreemd? }`: richting-specifiek — `nl` geldt in vreemd->nl, `vreemd` in
   *   nl->vreemd. Zo mag Stijn bij "vertaal regarder" zowel "bekijken" als "kijken naar".
   */
  acceptedAnswers?: string[] | { nl?: string[]; vreemd?: string[] };
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

// ── Cat 3 (Biologie / Aardrijkskunde / Geschiedenis) ─────────────────────────
// Contract uit SPEC §4 Stage 3 + §5 Cat 3. Een Cat 3-vak is "gemengd":
//   - flashcards.json   → begrippen/feiten/topografie (Cat 1 secundair, strikt)
//   - oefenvragen.json  → open begripsvragen met modelAntwoord + rubric (Cat 3, soft)
//   - samenvatting/<onderwerp>.md → verplichte lees-fase (markdown, hier geen type)

/**
 * Eén flashcard (Cat 1 secundair): begrip, feit of topografie-label.
 * Bestand: content/<editie>/trainers/<vak>/flashcards.json.
 */
export interface Flashcard {
  /** Stabiele id: <vak>-h<hoofdstuk>-<onderdeel>-<n>, bv. "ak-h6-begrip-007". */
  id: string;
  /** Voorzijde / vraag (bv. een omschrijving of "Wat is …?"). */
  vraag: string;
  /** Achterzijde / (model)antwoord — het te kennen begrip/feit. */
  antwoord: string;
  /** Extra geaccepteerde vormen van het antwoord (synoniemen, met/zonder lidwoord). */
  acceptedAnswers?: string[];
  /**
   * Hoe overhoord wordt:
   *  - "typen" (default): Stijn typt het antwoord; gescoord met `normalisatie`.
   *  - "kaart": flip-kaart met referentie-`afbeelding` (topografie zonder hotspots,
   *    SPEC §4 — de klikbare hotspot-versie is een latere upgrade).
   */
  modus?: "typen" | "kaart";
  /** Override op het normalisatieprofiel van het bestand (bv. "exact" voor topografie). */
  normalisatie?: NormalisatieProfiel;
  /** Optioneel onderwerp/subkop (bv. "§6.1 Golfstroom", "topografie 5.2"). */
  onderdeel?: string;
  /** Optionele referentie-afbeelding (relatief t.o.v. editie-root). */
  afbeelding?: string;
  hoofdstuk: string;
  /** Pad naar de raw screenshot waaruit dit item is afgeleid (relatief t.o.v. editie-root). */
  bron: string;
  /** Extractie-confidence 0..1 (review-trigger onder drempel, SPEC §4). */
  confidence: number;
}

/** Bestand content/<editie>/trainers/<vak>/flashcards.json. */
export interface FlashcardBestand {
  vak: string;
  /** Default normalisatieprofiel voor getypte antwoorden (per kaart te overschrijven). */
  normalisatie: NormalisatieProfiel;
  kaarten: Flashcard[];
}

/**
 * Eén open begripsvraag (Cat 3). Bestand: content/<editie>/trainers/<vak>/oefenvragen.json.
 * Tot de LLM-proxy er is, toont de trainer deze in flashcard-modus: vraag → modelAntwoord
 * (geen automatische beoordeling). De `rubric` is dan al vastgelegd voor latere LLM-scoring.
 */
export interface Oefenvraag {
  /** Stabiele id: <vak>-h<hoofdstuk>-<onderdeel>-<n>, bv. "ak-h6-vraag-003". */
  id: string;
  /** De open vraag ("leg uit waarom…", "wat gebeurt er als…"). */
  vraag: string;
  /** Modelantwoord — VERPLICHT (validator + flashcard-fallback, SPEC §4). */
  modelAntwoord: string;
  /** Beoordelingscriteria voor de latere LLM-rubric (compleetheid, kernbegrippen, verbanden). */
  rubric: string[];
  /** Optioneel onderwerp/subkop. */
  onderdeel?: string;
  /** Optionele referentie-afbeelding (relatief t.o.v. editie-root). */
  afbeelding?: string;
  hoofdstuk: string;
  /** Pad naar de raw screenshot waaruit dit item is afgeleid (relatief t.o.v. editie-root). */
  bron: string;
  /** Extractie-confidence 0..1. */
  confidence: number;
}

/** Bestand content/<editie>/trainers/<vak>/oefenvragen.json. */
export interface OefenvraagBestand {
  vak: string;
  vragen: Oefenvraag[];
}

// ── Cat 4 (Nederlands / Engels — productieve schrijfvaardigheid) ─────────────
// Een schrijfopdracht: lees een tekstfragment, schrijf (informele) brief, krijg
// LLM-feedback, herzie één keer, krijg dan een score + verbeterpunten (SPEC §5 Cat 4).

/** Eén begeleidings-stap (alleen voor begeleide opdrachten): een deel van de brief. */
export interface SchrijfStap {
  /** Stabiele sleutel, bv. "aanhef", "kern", "slot". */
  sleutel: string;
  /** Label boven het tekstvak. */
  label: string;
  /** Stimulerende hint/placeholder voor dit deel. */
  hint: string;
}

/** Eén schrijfopdracht. Bestand: content/<editie>/trainers/<vak>/schrijfopdrachten.json. */
export interface Schrijfopdracht {
  id: string;
  titel: string;
  /** Het te lezen tekstfragment (markdown/plain). */
  tekstfragment: string;
  /** De schrijfopdracht zelf. */
  opdracht: string;
  /** Begeleid (per-deel tekstvakken met hints) of vrij (één tekstvak). */
  begeleid: boolean;
  /** Alleen bij begeleid: de delen van de brief. */
  stappen?: SchrijfStap[];
  /** Zelf-nakijk-checklist (fallback als er geen LLM-feedback beschikbaar is). */
  checklist: string[];
  /** Pad/oorsprong van het materiaal (gegenereerd voorbeeld → expliciet vermelden). */
  bron: string;
  confidence: number;
}

/** Bestand content/<editie>/trainers/<vak>/schrijfopdrachten.json. */
export interface SchrijfopdrachtBestand {
  vak: string;
  opdrachten: Schrijfopdracht[];
}
