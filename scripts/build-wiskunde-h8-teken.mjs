// Voegt H8 "doe-op-papier + afvinken"-opgaven toe aan tekenopgaven.json:
// redeneer/onderzoek + de breuk-opgave (Ralph 2026-06-15: niet auto-nakijkbaar →
// teken-/afvink-trainer). Idempotent voor hoofdstuk 8. Draai NA build-wiskunde-h9-teken.mjs
// (die schrijft het bestand; deze voegt H8 toe):
//   node scripts/build-wiskunde-h9-teken.mjs && node scripts/build-wiskunde-h8-teken.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAD = join(ROOT, "content/2026-t3/trainers/wiskunde/tekenopgaven.json");
const TITEL = {
  "8.2": "§8.2 Haakjes wegwerken", "8.3": "§8.3 Machten",
  "8.4": "§8.4 De wetenschappelijke notatie", "8.5": "§8.5 Machten en letters",
};
const BRON = { "8.2": "p110", "8.3": "p117", "8.4": "p122", "8.5": "p127" };

// [sectie, opgave, vraag, tip?]
const DATA = [
  ["8.2", "17", "Werk de haakjes weg (let op de breuken): a -⅓a(½b − 6c)   b -¼(-4q − ⅓r)   c ⅔b(⅕c − 1½d)", "Schrijf de breuk-coëfficiënten netjes uit."],
  ["8.2", "21", "Vul in: a 5(a + ▢) = ▢ + 10b   b 7p − 2(▢ − 3q) = p + ▢   c −4(x − ▢) − 3y = ▢ + 9y"],
  ["8.2", "30", "Je kent de regel a(b + c) = ab + ac. Acht beweringen, vijf zijn juist. Onderzoek welke juist zijn en geef bij de onjuiste een tegenvoorbeeld: 1 (a+b)c = ac+bc  2 (a+b):c = a:c+b:c  3 a:(b+c) = a:b+a:c  4 a−(b+c) = a−b+a−c  5 a·(b:c) = (a·b):(a·c)  6 a(b+c+d+e) = ab+ac+ad+ae  7 a:(b:c) = a·c:b  8 a:(b·c) = a:b:c"],
  ["8.3", "36", "a Maak een lijst met machten van 2 tot en met 2^15. b Bekijk het laatste cijfer van elke uitkomst — wat valt je op? c Welke van 2^19, 2^23, 2^38, 2^55 eindigen op een 8? d Schrijf vijf machten van 2 die op een 6 eindigen. e Op welk cijfer eindigt 2^94? f 9^23? g 5^37? h 6^128?"],
  ["8.3", "42", "a Bereken (−1)^2, (−1)^3, (−1)^4, (−1)^5 en (−1)^6 — wat valt je op? b Bepaal zonder te rekenen of de uitkomst positief of negatief is: (−4)^6, (−0,3)^9, (−11)^19, (−7)^10, (−5)^7, (−1)^10, (−1,5)^12, (−12)^15. c Wat heb je bij a en b ontdekt? d Waarom geldt deze regel niet voor −7^4?"],
  ["8.4", "53", "a Bereken 10^5 — hoeveel nullen staan er in het antwoord? b En bij 10^7? c Hoeveel nullen krijg je bij 10^9? d Hoeveel nullen heeft een miljoen? Schrijf miljoen als macht van 10. e Schrijf miljard als macht van 10."],
  ["8.5", "66", "Luuk zegt: 2^5 · 2^3 = 2^8. Stan zegt: 2^5 · 2^3 = 4^8. a Wie heeft gelijk? Waarom? Schrijf telkens als één macht: b 3^8 · 3^11   c 2^2 · 4^8   d 2^6 · 8"],
  ["8.5", "72", "Vul in: a 8x^6 + ▢ = 12x^6   b 6x^4 · ▢ = 12x^6   c x · ▢ = 12x^6   d 15x^6 − ▢ = 12x^6   e −2x^4 · ▢ = 12x^6   f 3x · ▢ = 12x^6"],
  ["8.5", "73", "Bedenk een s.o. van zes herleidingen die elk 18a^8 als uitkomst hebben: twee vermenigvuldigingen, twee optellingen en twee aftrekkingen."],
  ["8.5", "76", "Vul in: a ▢(a^5 + 3a) = ▢ + 15a^2   b 8a^4 − 2a^3(a − ▢) = 6a^4 + 12a^7   c a^3 · a^6 + ▢(a^9 − 3a^7) = 3a^11 − 8a^9   d 2a^5(3a − ▢) − a^4(▢ + 4a) = 5a^6"],
];

const h8 = DATA.map(([sectie, opgave, vraag, tip]) => ({
  id: `wiskunde-h8-${sectie}-opg${opgave}`,
  hoofdstuk: "8",
  paragraaf: sectie,
  onderdeelTitel: TITEL[sectie],
  opgave,
  vraag,
  ...(tip ? { tip } : {}),
  bron: `raw/wiskunde/wiskunde-h08-${BRON[sectie]}.jpg`,
  confidence: 0.95,
}));

const bestand = JSON.parse(readFileSync(PAD, "utf8"));
bestand.opgaven = bestand.opgaven.filter((o) => o.hoofdstuk !== "8").concat(h8);
writeFileSync(PAD, JSON.stringify(bestand, null, 2) + "\n");
console.log(`H8 teken/afvink toegevoegd: ${h8.length}. Totaal tekenopgaven: ${bestand.opgaven.length}.`);
