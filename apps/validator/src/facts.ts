import type { VocabBestand, VocabItem } from "@pww/shared";
import type { Fact } from "./types.js";
import { normKey, normValue } from "./normalize.js";

/** Maak een vergelijkbaar Fact uit een vocab-item (NL = sleutel, vreemd = waarde). */
export function vocabItemNaarFact(item: VocabItem): Fact {
  return {
    key: normKey(item.nl),
    value: normValue(item.vreemd),
    bronKey: item.nl,
    bronValue: item.vreemd,
    id: item.id,
    ...(item.bron !== undefined ? { bron: item.bron } : {}),
  };
}

/** Trek alle facts uit een vocab.json-bestand (Cat 1). */
export function extractTrainerFacts(bestand: VocabBestand): Fact[] {
  return bestand.items.map(vocabItemNaarFact);
}
