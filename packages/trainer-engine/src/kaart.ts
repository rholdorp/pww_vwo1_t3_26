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
/**
 * Extra geaccepteerde antwoorden voor één kant. Een kale `string[]` is legacy en
 * betekent vormen van het *vreemde* antwoord (alleen relevant in nl->vreemd).
 */
function extraAntwoorden(
  aa: VocabItem["acceptedAnswers"],
  kant: "nl" | "vreemd",
): string[] {
  if (!aa) return [];
  if (Array.isArray(aa)) return kant === "vreemd" ? aa : [];
  return aa[kant] ?? [];
}

export function bouwKaart(item: VocabItem, richting: Richting): Kaart {
  if (richting === "nl->vreemd") {
    const prompt = item.vorm ? `${item.nl} (${item.vorm})` : item.nl;
    return {
      prompt,
      accepted: [item.vreemd, ...extraAntwoorden(item.acceptedAnswers, "vreemd")],
    };
  }
  return {
    prompt: item.vreemd,
    accepted: [item.nl, ...extraAntwoorden(item.acceptedAnswers, "nl")],
  };
}
