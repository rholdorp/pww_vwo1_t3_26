/**
 * POC-fixtures: 8 representatieve opgaven uit H8 + H9, één per onderdeel-type.
 * Voor de POC handmatig geformuleerd zodat we de pipeline kunnen testen
 * voordat Stage 2 extract de echte opgavetekst uit raw haalt.
 */

import type { Opgave } from "./types.js";

export const POC_FIXTURES: Opgave[] = [
  {
    id: "wi-poc-h8-2a-haakjes-eenvoudig",
    vraag: "Werk de haakjes weg en herleid: 3(x + 4)",
    context: { hoofdstuk: "8", paragraaf: "8.2", onderdeel: "8.2a" },
  },
  {
    id: "wi-poc-h8-2b-minteken-haakjes",
    vraag: "Werk de haakjes weg: -(2x - 5)",
    context: { hoofdstuk: "8", paragraaf: "8.2", onderdeel: "8.2b" },
  },
  {
    id: "wi-poc-h8-3a-macht-berekenen",
    vraag: "Bereken: 2^5",
    context: { hoofdstuk: "8", paragraaf: "8.3", onderdeel: "8.3a" },
  },
  {
    id: "wi-poc-h8-3c-negatief-grondtal",
    vraag: "Bereken: (-3)^4",
    context: { hoofdstuk: "8", paragraaf: "8.3", onderdeel: "8.3c" },
  },
  {
    id: "wi-poc-h8-4b-wetenschappelijke-notatie",
    vraag: "Schrijf in wetenschappelijke notatie: 0,00045",
    context: { hoofdstuk: "8", paragraaf: "8.4", onderdeel: "8.4b" },
  },
  {
    id: "wi-poc-h8-5a-machten-vermenigvuldigen",
    vraag: "Herleid: a^3 * a^5",
    context: { hoofdstuk: "8", paragraaf: "8.5", onderdeel: "8.5a" },
  },
  {
    id: "wi-poc-h9-3b-gelijkbenige-driehoek",
    vraag:
      "In driehoek ABC is AB = AC en hoek A = 40°. Bereken de hoeken B en C.",
    context: { hoofdstuk: "9", paragraaf: "9.3", onderdeel: "9.3b" },
  },
  {
    id: "wi-poc-h9-5a-z-hoeken",
    vraag:
      "Twee evenwijdige lijnen worden gesneden door een snijlijn. Een Z-hoek meet 65°. Hoe groot is de andere Z-hoek?",
    context: { hoofdstuk: "9", paragraaf: "9.5", onderdeel: "9.5a" },
  },
];
