// Vult de resterende SCHOON-TYPBARE H8-opgaven aan in opgaven.json (gat-vulling
// na de inventaris-pass 2026-06-15). Elke (vraag→antwoord) door narekenen geverifieerd;
// antwoorden uit de antwoorden-bijlage. Idempotent: verwijdert eerst eigen ids.
// Draai NA build-wiskunde-h8.mjs + h9-opgaven:
//   node scripts/build-wiskunde-h8.mjs && node scripts/build-wiskunde-h9-opgaven.mjs && node scripts/build-wiskunde-h8-extra.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAD = join(ROOT, "content/2026-t3/trainers/wiskunde/opgaven.json");
const TITEL = {
  "8.1": "§8.1 Herleiden", "8.2": "§8.2 Haakjes wegwerken", "8.3": "§8.3 Machten",
  "8.4": "§8.4 De wetenschappelijke notatie", "8.5": "§8.5 Machten en letters",
};

// {ond, n, instr, type, page, exact?, L:[[letter, vraag, antwoord, accepted?]]}
const NIEUW = [
  { ond: "8.1", n: "3", instr: "Herleid:", type: "herleiden", page: 106, L: [
    ["a", "5 · 2b + 10 · 3b", "40b"], ["b", "-5 · 2b + 3 · b", "-7b"], ["c", "8 · -2b - 5 · 3b", "-31b"],
    ["d", "5a · 2b - 2a · b", "8ab"], ["e", "5a · 3b - 2a · c", "15ab - 2ac"], ["f", "-8a · 3 - 5 · -3a", "-9a"] ] },
  { ond: "8.1", n: "4", instr: "Herleid:", type: "herleiden", page: 106, L: [
    ["a", "3 · 2x + 4 · 2x", "14x"], ["b", "5 · 3y - 8 · 2y", "-y"], ["c", "5x · 2y - 15x · y", "-5xy"],
    ["d", "3x · 2z - 5x · 2y", "6xz - 10xy"], ["e", "-4 · 2x - 8 · 6", "-8x - 48"], ["f", "-4 · 2x - 8x · -3", "16x"] ] },
  { ond: "8.2", n: "L4", instr: "Werk de haakjes weg:", type: "haakjes", page: 113, L: [
    ["c", "-(a - 4b) - 5a", "-6a + 4b", ["4b - 6a"]] ] },
  { ond: "8.3", n: "32", instr: "Bereken:", type: "machten", page: 114, L: [
    ["a", "5^3", "125"] ] },
  { ond: "8.3", n: "37", instr: "Bereken:", type: "machten", page: 117, L: [
    ["a", "2^3 · 5", "40"], ["b", "2 · 5^3", "250"], ["c", "2^3 - 5^3", "-117"],
    ["d", "(5 - 2)^4 + 2", "83"], ["e", "(3 · 4)^2 - 8", "136"], ["f", "3 · 7^2 - 8", "139"] ] },
  { ond: "8.4", n: "L8", instr: "Schrijf in de wetenschappelijke notatie:", type: "wet-notatie", page: 123, exact: true, L: [
    ["a", "54000", "5,4 · 10^4", ["5.4*10^4"]], ["b", "3416000", "3,416 · 10^6", ["3.416*10^6"]],
    ["c", "37200000", "3,72 · 10^7", ["3.72*10^7"]] ] },
  { ond: "8.5", n: "56", instr: "Schrijf als gewoon getal:", type: "wet-notatie", page: 124, L: [
    ["a", "5,7 · 10^5", "570000"], ["b", "1,236 · 10^4", "12360"], ["c", "4,28 · 10^5", "428000"], ["d", "3,2 · 10^2", "320"] ] },
  { ond: "8.5", n: "57", instr: "Bereken en schrijf in de wetenschappelijke notatie (rond af op 2 decimalen):", type: "wet-notatie", page: 124, L: [
    ["a", "2^58", "2,88 · 10^17", ["2.88*10^17"]], ["b", "5,3^28", "1,90 · 10^20", ["1.9*10^20", "1,9 · 10^20"]],
    ["c", "1,8 · 3,7^25", "2,89 · 10^14", ["2.89*10^14"]], ["d", "2,5^14 : 0,21^9", "4,69 · 10^11", ["4.69*10^11"]] ] },
  { ond: "8.5", n: "L9", instr: "Bereken en schrijf in de wetenschappelijke notatie (rond af op 2 decimalen):", type: "wet-notatie", page: 124, L: [
    ["a", "3,7^21", "8,56 · 10^11", ["8.56*10^11"]], ["b", "4,76 · 6,1^17", "1,07 · 10^14", ["1.07*10^14"]],
    ["c", "3,1^31 : 0,13^13", "5,64 · 10^26", ["5.64*10^26"]] ] },
];

const nieuw = [];
for (const o of NIEUW) {
  for (const [letter, vraag, antwoord, accepted] of o.L) {
    nieuw.push({
      id: `wiskunde-h8-${o.ond}-${o.n}${letter}`,
      hoofdstuk: "8",
      onderdeel: o.ond,
      onderdeelTitel: TITEL[o.ond],
      opgavenummer: `${o.n}${letter}`,
      vraag: `${o.instr} ${vraag}`,
      antwoord,
      ...(accepted ? { acceptedForms: accepted } : {}),
      type: o.type,
      ...(o.exact ? { exacteVorm: true } : {}),
      isSynthese: false,
      bron: `raw/wiskunde/wiskunde-h08-p${o.page}.jpg`,
      antwoordBron: "raw/wiskunde/PXL_20260610_064337710.jpg",
      confidence: 0.95,
      verifiedBy: "boek",
    });
  }
}

const nieuweIds = new Set(nieuw.map((o) => o.id));
const bestand = JSON.parse(readFileSync(PAD, "utf8"));
bestand.opgaven = bestand.opgaven.filter((o) => !nieuweIds.has(o.id)).concat(nieuw);
writeFileSync(PAD, JSON.stringify(bestand, null, 2) + "\n");
console.log(`H8-extra toegevoegd: ${nieuw.length} sub-items (${NIEUW.length} opgaven). Totaal: ${bestand.opgaven.length}.`);
