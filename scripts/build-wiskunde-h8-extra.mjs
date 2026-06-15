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

  // Woordproblemen met een KALE expressie/getal als antwoord (Ralph 2026-06-15: "alleen
  // schoon-antwoord-types"). `vol:true` → de hele vraagtekst staat in het L-veld (geen instr-prefix).
  { ond: "8.2", n: "26", vol: true, type: "toepassing", page: 112, L: [
    ["d", "Tamara vermenigvuldigt het getal y met 3 en trekt er vervolgens 8 van af. Welke uitkomst krijgt ze?", "3y - 8"] ] },
  { ond: "8.2", n: "27", vol: true, type: "toepassing", page: 112, L: [
    ["b", "Jappie telt 5 op bij het getal p en vermenigvuldigt de uitkomst met 4. Wat krijgt hij?", "4p + 20"] ] },
  { ond: "8.2", n: "28", vol: true, type: "toepassing", page: 112, L: [
    ["a", "Ga uit van het getal a. Tel er 2 bij op en vermenigvuldig de uitkomst met 3. Wat krijg je?", "3a + 6"],
    ["b", "Ga uit van het getal b. Vermenigvuldig dat met 2 en trek er vervolgens 10 van af. Vermenigvuldig de uitkomst met 3. Wat krijg je?", "6b - 30"],
    ["c", "Ga uit van het getal c. Tel er 5 bij op en vermenigvuldig de uitkomst met 4. Trek er vervolgens 4 keer het getal c van af. Wat krijg je?", "20"] ] },
  { ond: "8.2", n: "29", vol: true, type: "toepassing", page: 113, L: [
    ["a", "Ga uit van het getal a. Vermenigvuldig dat met 3 en tel er 5 keer het getal b bij op. Vermenigvuldig de uitkomst met 2. Wat krijg je?", "6a + 10b"],
    ["c", "Trish gaat uit van drie opeenvolgende gehele getallen. Het kleinste getal is n. Ze vermenigvuldigt elk van de drie getallen met 2 en telt de uitkomsten bij elkaar op. Wat krijgt ze?", "6n + 6"] ] },
  { ond: "8.4", n: "52", vol: true, type: "toepassing", page: 122, L: [
    ["", "Tijdens corona verdubbelde bij reproductiegetal 2 elke dag het aantal besmettingen. In een week met reproductiegetal 1,15 waren er aan het eind 100 000 mensen besmet. Bereken hoeveel mensen er aan het begin van die week besmet waren (rond af op honderdtallen).", "37594"] ] },
  { ond: "8.4", n: "L7", vol: true, type: "toepassing", page: 122, L: [
    ["a", "Bereken (-4,3)^4 - 2,7^3. Rond af op gehelen.", "322"] ] },
  { ond: "8.4", n: "51", vol: true, type: "machten", page: 121, exact: true, L: [
    ["b", "Johan heeft per generatie terug 2× zoveel voorouders. Schrijf het aantal voorouders van tien generaties terug als macht van 2.", "2^10"] ] },
  { ond: "8.4", n: "55", vol: true, type: "wet-notatie", page: 123, exact: true, L: [
    ["a", "Een volwassen olifant kan 6 900 000 gram wegen. Schrijf dit getal in de wetenschappelijke notatie.", "6,9 · 10^6", ["6.9*10^6"]],
    ["b", "Per dag maakt je lichaam 225 000 000 rode bloedlichaampjes aan. Schrijf dit getal in de wetenschappelijke notatie.", "2,25 · 10^8", ["2.25*10^8"]],
    ["c", "In een mensenleven slaat het hart ongeveer 2 800 000 000 keer. Schrijf dit getal in de wetenschappelijke notatie.", "2,8 · 10^9", ["2.8*10^9"]],
    ["d", "Het aantal haren op een hoofd is ongeveer 140 000. Schrijf dit getal in de wetenschappelijke notatie.", "1,4 · 10^5", ["1.4*10^5"]],
    ["e", "Medio 2022 zijn er via Ecosia al 163 000 000 bomen geplant. Schrijf dit getal in de wetenschappelijke notatie.", "1,63 · 10^8", ["1.63*10^8"]] ] },
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
      vraag: o.vol ? vraag : `${o.instr} ${vraag}`,
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
