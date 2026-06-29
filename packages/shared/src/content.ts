// Canoniek trainer-content-contract (SPEC §4 Stage 3).
// Dit is het stabiele contract waarop de trainer-engines, validator en web draaien.
// Wijzigingen vereisen SPEC-update + version-bump.

/** Normalisatie-profiel bepaalt hoe een getypt antwoord met het juiste wordt vergeleken (SPEC §5 Cat 1). */
export type NormalisatieProfiel =
  | "frans" // accenten strikt vereist (été ≠ ete); 1-teken-typo → "bijna goed"
  | "zin" // hele zinnen: accenten strikt, leestekens (. , ? !) genegeerd, apostrof/koppelteken behouden (j'habite, qu'est-ce que)
  | "en-zin" // Engelse zinnen: als "zin" maar accenten optioneel, géén Franse accent-helperrij
  | "engels" // accenten optioneel, getallen exact
  | "begrip" // toleranter: leestekens negeren, lidwoorden optioneel (de cel = cel)
  | "wiskunde" // Cat 2: alléén cosmetische verschillen (²→^2, ·→*, komma→punt, breuk/getal-canonical); strikt de simpelste vorm uit het antwoordenboekje. Geen "bijna".
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
   * Curated foute antwoorden voor de meerkeuze-variant — afleiders die ín de context
   * passen (handmatig/Cowork samengesteld). Hebben voorrang boven auto-gegenereerde
   * afleiders. 0 of 3 stuks; bij <3 vult de trainer aan uit de vak-woordenschat.
   */
  wrongAnswers?: string[];
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
 * Redeneer-meerkeuze-variant van een begripsvraag (Cat 3).
 *
 * Voor vakken waar het examen (deels) meerkeuze is — bv. biologie/aardrijkskunde puur mc,
 * geschiedenis gemengd — wordt de vraag óók als enkel-juist-antwoord mc aangeboden. Het
 * juiste alternatief is een volledige verklaring (examenformat); de afleiders zijn
 * plausibele misvattingen die ín de stof passen. Net als bij `Flashcard.wrongAnswers`:
 * precies 3 afleiders, handmatig/Cowork samengesteld.
 */
export interface OefenvraagMC {
  /** Optionele mc-herformulering van de stam; default = `Oefenvraag.vraag`. */
  vraag?: string;
  /** Het juiste alternatief — één bondige, volledige verklaring. */
  antwoord: string;
  /** Precies 3 afleiders: plausibele misvattingen (mogen `antwoord` niet bevatten). */
  wrongAnswers: string[];
}

/**
 * Eén begripsvraag (Cat 3). Bestand: content/<editie>/trainers/<vak>/oefenvragen.json.
 *
 * Twee overhoorvormen, gestuurd door `modus`:
 *  - open  (default): vraag → `modelAntwoord`, zelf nakijken (Cat 3-fallback, geen LLM nodig).
 *  - mc:    toon de redeneer-mc uit `mc` (examenformat, bv. biologie/aardrijkskunde).
 *  - beide: eerst mc, daarna de open verdieping (gemengd examen, bv. geschiedenis).
 * `modelAntwoord`/`rubric` blijven altijd bewaard (validator + latere LLM-scoring).
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
  /**
   * Overhoormodus. Afwezig = "open" (oud gedrag, ongewijzigd).
   * "mc"/"beide" vereisen een ingevuld `mc`-veld.
   */
  modus?: "open" | "mc" | "beide";
  /** Redeneer-mc-variant; aanwezig bij `modus` "mc" of "beide". */
  mc?: OefenvraagMC;
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

// ── Gelabelde diagrammen / hotspots (Cat 1 met beeld-prompt — SPEC §4/§5) ────
// Een diagram draait op de Cat 1-leerlogica (typen/Leitner/normalisatie), maar de
// "plek" is een region op een afbeelding. Twee bron-types, beide leveren
// `.region`-elementen met een `data-region`:
//   - shaped SVG: vormen met data-region (bv. biologie skelet/spieren).
//   - afbeelding + cirkel-overlay: een PNG als achtergrond + markers per region (topo).
// Twee richtingen: "benoem" (region licht op → typ de naam) en "aanwijs" (naam → klik region).
// NB: we gebruiken bewust SVG data-region + %-markers i.p.v. de pixel-`coords` uit
// het SPEC §4-voorbeeld — schoner en schaalbaar (zie docs/BACKLOG.md).

/** Eén benoembare/aanwijsbare region van een diagram. */
export interface DiagramRegio {
  /** Matcht het `data-region`-attribuut in de SVG (shaped) of een marker-id (overlay). */
  id: string;
  /** Het te kennen antwoord (bv. "scheenbeen", "Vietnam"). */
  naam: string;
  /** Extra geaccepteerde vormen van de naam (synoniemen, met/zonder lidwoord). */
  acceptedAnswers?: string[];
  /** Optionele hint (positie-omschrijving) bij de aanwijs-richting. */
  hint?: string;
}

/** Cirkel-overlay-positie (%) van een region op een achtergrondafbeelding. */
export interface DiagramMarker {
  /** Matcht een DiagramRegio.id. */
  id: string;
  /** Horizontale positie 0–100 (% van de afbeeldingsbreedte). */
  x: number;
  /** Verticale positie 0–100 (% van de afbeeldingshoogte). */
  y: number;
}

/** Eén diagram. */
export interface Diagram {
  /** Stabiele id, bv. "biologie-skelet". */
  id: string;
  /** Titel boven het diagram, bv. "Het skelet". */
  titel: string;
  hoofdstuk?: string;
  /** Normalisatie voor de benoem-richting (default "begrip"). */
  normalisatie?: NormalisatieProfiel;
  /** Vraagtekst voor de benoem-richting (default "Welk onderdeel is dit?"). */
  benoemVraag?: string;
  /** Welke richtingen geoefend worden (default: beide). */
  richtingen?: ("benoem" | "aanwijs")[];
  /** Pad naar een shaped SVG met `data-region` per region (relatief t.o.v. editie-root). */
  svg?: string;
  /** Pad naar een achtergrondafbeelding (overlay-modus; relatief t.o.v. editie-root). */
  afbeelding?: string;
  /** Bij `afbeelding`: cirkel-positie per region. */
  markers?: DiagramMarker[];
  regios: DiagramRegio[];
}

/** Bestand content/<editie>/trainers/<vak>/diagram.json. */
export interface DiagramBestand {
  vak: string;
  diagrammen: Diagram[];
}

// ── Cat 2 (Wiskunde — reken-/herleidvaardigheid) ─────────────────────────────
// Een Cat-2-vak oefent een toetsbare vaardigheid actief: Stijn maakt de som op
// papier en typt het EINDantwoord; de trainer kijkt strikt na tegen het
// antwoordenboekje (de simpelste vorm). Adaptief per onderdeel (= paragraaf),
// SPEC §5 Cat 2. Antwoordenboek heeft alléén eindantwoorden → fout toont het
// juiste antwoord + een vergelijkbare som (geen uitwerkingen).

/** Eén opgave (Cat 2). Bestand: content/<editie>/trainers/<vak>/opgaven.json. */
export interface Opgave {
  /** Stabiele id: <vak>-h<hoofdstuk>-<onderdeel>-<nummer>, bv. "wiskunde-h8-8.2-10a". */
  id: string;
  /** Hoofdstuk, bv. "8". */
  hoofdstuk: string;
  /** Paragraaf/onderdeel, bv. "8.2" of "voorkennis". */
  onderdeel: string;
  /** Onderdeel-titel (leesbaar), bv. "§8.2 Machten". */
  onderdeelTitel: string;
  /** Opgavenummer inclusief subletter, bv. "10a". */
  opgavenummer: string;
  /** De opgave-tekst (overgetypt uit het lesboek → trainer werkt zonder boek). */
  vraag: string;
  /** Het juiste EINDantwoord (de simpelste vorm, letterlijk uit het antwoordenboekje). */
  antwoord: string;
  /**
   * Extra écht-gelijkwaardige simpele vormen die óók goed zijn (escape-hatch,
   * bv. termvolgorde `a+b` = `b+a`). Bewust spaarzaam: een niet-vereenvoudigde
   * vorm hoort hier NIET in — die is fout (H8 gaat over vereenvoudigen).
   */
  acceptedForms?: string[];
  /** Vraagtype (grof, voor weergave/sortering), bv. "herleiden", "machten", "wet-notatie". */
  type: string;
  /** Optionele figuur bij de opgave (meetkunde H9), relatief t.o.v. editie-root. */
  afbeelding?: string;
  /**
   * Grade alléén op exacte (cosmetische) vorm, zónder getal-/breuk-canonical.
   * Voor opgaven waar de VORM telt, niet de waarde (bv. wetenschappelijke notatie:
   * `4,8·10^5` goed, maar `480000` fout). Default false.
   */
  exacteVorm?: boolean;
  /**
   * Synthese-opgave: combineert meerdere onderdelen. Pas beschikbaar als alle
   * losse onderdelen ✓ zijn (SPEC §5 Cat 2).
   */
  isSynthese?: boolean;
  /** Pad naar de raw screenshot van de OPGAVE (lesboek). */
  bron: string;
  /** Pad naar de raw screenshot van het ANTWOORD (antwoordenboekje). */
  antwoordBron?: string;
  /** Extractie-confidence 0..1 (review-trigger onder drempel, SPEC §4). */
  confidence: number;
  /** Hoe het antwoord geverifieerd is. Cat 2: altijd "boek" (antwoordenboekje). */
  verifiedBy: "boek";
}

/** Bestand content/<editie>/trainers/<vak>/opgaven.json. */
export interface OpgavenBestand {
  vak: string;
  /** Normalisatie voor het eindantwoord — Cat 2 altijd "wiskunde". */
  normalisatie: NormalisatieProfiel;
  opgaven: Opgave[];
}

// ── Teken-/doe-opgaven (meetkunde H9) — afvinken, geen automatisch antwoord ──
// Opgaven met een figuur maar zonder eenduidig typbaar antwoord (spiegelen,
// symmetrieassen tekenen, construeren). Stijn doet ze op papier en vinkt af; geen
// nakijk/zelfbeoordeling (besluit Ralph 2026-06-15). Onderscheiden van Cat 2
// (nakijkbare opgaven) via de bestandsnaam-marker bij het croppen (…-teken vs …-nakijk).

/** Eén teken-/doe-opgave. Bestand: content/<editie>/trainers/<vak>/tekenopgaven.json. */
export interface Tekenopgave {
  /** Stabiele id: <vak>-h<hoofdstuk>-<paragraaf>-opg<nummer>, bv. "wiskunde-h9-9.1-opg2". */
  id: string;
  hoofdstuk: string;
  /** Paragraaf/onderdeel, bv. "9.1" of "voorkennis". */
  paragraaf: string;
  /** Leesbare onderdeel-titel, bv. "§9.1 Lijnsymmetrie". */
  onderdeelTitel: string;
  /** Opgavenummer, bv. "2" of "L1". */
  opgave: string;
  /** De opdracht ("Teken alle symmetrieassen.", "Teken het spiegelbeeld van P in lijn s."). */
  vraag: string;
  /** Optionele figuur bij de opgave (relatief t.o.v. editie-root). */
  afbeelding?: string;
  /** Optionele 'let op'-tip (geen antwoord, alleen een aandachtspunt bij het doen). */
  tip?: string;
  /** Pad naar de raw screenshot/lesboekpagina. */
  bron: string;
  confidence: number;
}

/** Bestand content/<editie>/trainers/<vak>/tekenopgaven.json. */
export interface TekenopgaveBestand {
  vak: string;
  opgaven: Tekenopgave[];
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
