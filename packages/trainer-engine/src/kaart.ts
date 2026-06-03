import type { Richting, VocabItem } from "@pww/shared";

/** Wat de UI toont en waartegen een getypt antwoord gescoord wordt, voor één richting. */
export interface Kaart {
  /** De vraag zoals getoond aan Stijn. */
  prompt: string;
  /** Geaccepteerde antwoorden (door te geven aan gradeAnswer). */
  accepted: string[];
}

/**
 * Bouw de vraag + geaccepteerde antwoorden voor een item in één richting.
 *
 * Het `vorm`-label (mannelijk/vrouwelijk/meervoud) hoort bij de vráág, niet bij het
 * antwoord:
 *  - nl->vreemd: toon `nl (vorm)` zodat duidelijk is wélke vorm gevraagd wordt, en
 *    accepteer de vreemde vorm(en).
 *  - vreemd->nl: toon de vreemde vorm (die de grammaticale vorm al impliceert) en
 *    accepteer de kále NL-betekenis — "vertaal belle" → Stijn typt "mooi".
 */
export function bouwKaart(item: VocabItem, richting: Richting): Kaart {
  if (richting === "nl->vreemd") {
    const prompt = item.vorm ? `${item.nl} (${item.vorm})` : item.nl;
    return { prompt, accepted: [item.vreemd, ...(item.acceptedAnswers ?? [])] };
  }
  return { prompt: item.vreemd, accepted: [item.nl] };
}
