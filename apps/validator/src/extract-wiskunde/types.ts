/**
 * Types voor Stage 2 extract — wiskunde-variant (SPEC §4).
 *
 * Twee output-shapes per pagina:
 *   - Cat. 2 opgaven (Cat 2 wiskunde-procedureel)
 *   - Cat. 1 feiten (formules, begrippen, eigenschappen uit theorie-blokken)
 */

export type Cat2OpgaveType =
  | "berekening"
  | "herleiden"
  | "oplossen-vergelijking"
  | "wetenschappelijke-notatie"
  | "meetkunde"
  | "open-vraag"
  | "anders";

/** Eén opgave zoals onafhankelijk uit een screenshot gehaald (vóór solver). */
export interface RawOpgave {
  opgavenummer: string;
  vraag: string;
  onderdeel: string | null;
  type: Cat2OpgaveType;
  bijzonderheden: string | null;
}

export type Cat1FeitType = "formule" | "begrip" | "eigenschap";

/** Eén feit/regel/begrip uit een theorie-blok. */
export interface RawFeit {
  type: Cat1FeitType;
  vraag: string;
  antwoord: string;
  context: string;
}

/** Cache-entry per screenshot (vergelijkbaar met rawExtractor CacheBestand). */
export interface ExtractCache {
  image: string;
  sha: string;
  model: string;
  extractedAt: string;
  /** Cat. 2 opgaven (kan leeg zijn voor pure theorie-pagina's). */
  opgaven: RawOpgave[];
  /** Cat. 1 feiten (kan leeg zijn voor opgaven-pagina's zonder theorie). */
  feiten: RawFeit[];
}
