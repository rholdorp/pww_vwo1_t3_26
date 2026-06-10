// Genereert content/2026-t3/trainers/wiskunde/opgaven.json voor Hoofdstuk 8.
//
// Bron: lesboek-foto's (vraagteksten) + antwoorden-bijlage (eindantwoorden), beide
// uit content/2026-t3/raw/wiskunde/. Elke (vraag → antwoord)-paring is met de hand
// door BEREKENING geverifieerd (de opgave vereenvoudigt/evalueert tot het
// boek-antwoord) — P8: een fout antwoord traint een foute reflex, dus alleen
// geverifieerde, schone, zelfstandige opgaven. Bewust NIET opgenomen (gevlagd in
// docs/BACKLOG.md + manifest): figuur-opgaven, woordproblemen, opgaven met
// breuk-coëfficiënt-antwoorden (matcher-onveilig), en antwoorden die in het boek
// een tekening/uitwerking ("*") zijn. Antwoordsleutel-foto's dekken t/m opg 54;
// A55/L8 (wet. notatie) wachten op de antwoordfoto.
//
// Draai: node scripts/build-wiskunde-h8.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UIT = join(ROOT, "content/2026-t3/trainers/wiskunde/opgaven.json");

// Per onderdeel: opgaven als {n, instr, page, exact?, L:[[letter, vraagExpr, antwoord, accepted?]]}.
// De getoonde vraag = `${instr} ${vraagExpr}`. type stuurt weergave.
const DATA = [
  {
    onderdeel: "voorkennis",
    titel: "Voorkennis: Rekenen met letters",
    type: "herleiden",
    page: 104,
    opgaven: [
      { n: "1", instr: "Herleid:", L: [
        ["a", "5a · 4b", "20ab"], ["b", "-3b · 4a", "-12ab"], ["c", "-2yz · -3x", "6xyz"],
        ["d", "5a · 6c · -b", "-30abc"], ["e", "-3z · -y · 7x", "21xyz"], ["f", "-m · -1 · -n", "-mn"] ] },
      { n: "2", instr: "Herleid:", L: [
        ["a", "12x · 3x", "36x^2"], ["b", "-9a · 2a", "-18a^2"], ["c", "-7e · -e", "7e^2"],
        ["d", "4x · 2y · x", "8x^2y"], ["e", "-2a · -3b · 2a", "12a^2b"], ["f", "2 · -x · -6xy", "12x^2y"] ] },
      { n: "3", instr: "Herleid:", L: [
        ["a", "7a + 8a", "15a"], ["b", "7a - 8a", "-a"], ["c", "7a + a", "8a"],
        ["d", "7a - 7a", "0"], ["e", "a - 7a", "-6a"] ] },
      { n: "4", instr: "Herleid:", L: [
        ["a", "3ab + 7ab", "10ab"], ["c", "ac - 2ac", "-ac"], ["d", "10abc - 10abc", "0"],
        ["e", "-ab + 3ab + 5ab", "7ab"], ["f", "3ac - 4ac + 2ac", "ac"] ] },
      { n: "5", instr: "Herleid:", L: [
        ["a", "2a + 3b + 5a + 4b", "7a + 7b", ["7b + 7a"]], ["b", "4x + 2 + x - 6", "5x - 4"],
        ["c", "3x - y + 5y - 4x", "-x + 4y", ["4y - x"]], ["d", "-m + n - 3m - 6n", "-4m - 5n", ["-5n - 4m"]] ] },
    ],
  },
  {
    onderdeel: "8.1",
    titel: "§8.1 Herleiden",
    type: "herleiden",
    page: 106,
    opgaven: [
      { n: "1", instr: "Herleid:", page: 105, L: [
        ["a", "6a + -2a", "4a"], ["b", "6a - -2a", "8a"], ["c", "-7p + -p", "-8p"],
        ["d", "-7p - -7p", "0"], ["e", "7p + -8p", "-p"], ["f", "-5x - -5x", "0"] ] },
      { n: "2", instr: "Herleid:", page: 105, L: [
        ["a", "4 · 3a", "12a"], ["b", "5 · 2a", "10a"], ["c", "4 · 3a + 5 · 2a", "22a"] ] },
      { n: "5", instr: "Herleid:", L: [
        ["a", "2 · 3x + 5 · 2x", "16x"], ["b", "2 + 3x + 5 + 2x", "7 + 5x", ["5x + 7"]],
        ["c", "2 · 3x + 5 + 2x", "8x + 5", ["5 + 8x"]], ["d", "-3 · 2x + 5x - 2x", "-3x"],
        ["e", "-3 + 2x + 5 - 2x", "2"], ["f", "-3 · 2x - 5 · 2x", "-16x"] ] },
      { n: "6", instr: "Herleid:", L: [
        ["a", "-3a - 3b + 2a - 3b", "-a - 6b", ["-6b - a"]], ["b", "-3a · -3b + 2a · -3b", "3ab"],
        ["c", "5x · 3y - 3x + 2y", "15xy - 3x + 2y"], ["d", "5 · 3y - 3x · -2y", "15y + 6xy"] ] },
      { n: "7", instr: "Herleid:", L: [
        ["a", "6a · -2b - 2b · -a + 5a · -2b", "-20ab"], ["b", "3a - 2b - 2b · -a + 5a · -2b", "3a - 2b - 8ab"],
        ["c", "3a - 2b - 2b - a + 5a - 2ab", "7a - 4b - 2ab"], ["d", "3b · -2a - 2b + 2b - a + 5a + 5ab", "-ab + 4a", ["4a - ab"]] ] },
      { n: "9", instr: "Herleid:", L: [
        ["a", "5a · (7b - 2b) + 10ab", "35ab"], ["b", "-6p · 2q - 7 · (p - 5p) + 5p · -2q", "-22pq + 28p", ["28p - 22pq"]],
        ["c", "-3x · 4y - (2xy + 8xy) : 2", "-17xy"] ] },
      { n: "L1", instr: "Herleid:", L: [
        ["a", "5 · 2a + 7 · 3a", "31a"], ["b", "3b · 4d - 8d · -5b", "52bd"], ["c", "-2 · 9c - 5 · 7", "-18c - 35"] ] },
    ],
  },
  {
    onderdeel: "8.2",
    titel: "§8.2 Haakjes wegwerken",
    type: "haakjes",
    page: 108,
    opgaven: [
      { n: "12", instr: "Werk de haakjes weg:", L: [
        ["a", "5(a + c)", "5a + 5c"], ["b", "8(2a + b)", "16a + 8b"], ["c", "a(3b + c)", "3ab + ac"],
        ["d", "x(2y + 3)", "2xy + 3x"], ["e", "1½(4x + 2y)", "6x + 3y"], ["f", "2p(q + 1)", "2pq + 2p"] ] },
      { n: "13", instr: "Werk de haakjes weg:", L: [
        ["a", "5a(2b + c)", "10ab + 5ac"], ["b", "3p(x + 3)", "3px + 9p"], ["c", "4a(b + ½)", "4ab + 2a"],
        ["d", "3c(a + 1)", "3ac + 3c"], ["e", "5a(c + 2)", "5ac + 10a"], ["f", "8p(2r + s)", "16pr + 8ps"] ] },
      { n: "14", instr: "Werk de haakjes weg:", L: [
        ["a", "6a(3b + ½c)", "18ab + 3ac"], ["b", "½p(4q + 8s)", "2pq + 4ps"] ] },
      { n: "15", instr: "Werk de haakjes weg:", page: 109, L: [
        ["a", "-4(x + 2y)", "-4x - 8y"], ["b", "4(x - 2y)", "4x - 8y"], ["c", "-4(x - 3)", "-4x + 12", ["12 - 4x"]],
        ["d", "-4(2x + 8)", "-8x - 32"], ["e", "-(2x - 3)", "-2x + 3", ["3 - 2x"]], ["f", "-(2x + 3)", "-2x - 3"] ] },
      { n: "16", instr: "Werk de haakjes weg:", page: 109, L: [
        ["a", "-3a(2b + c)", "-6ab - 3ac"], ["b", "5a(3b - c)", "15ab - 5ac"], ["c", "-2p(3q - 1)", "-6pq + 2p", ["2p - 6pq"]],
        ["d", "5q(2p + 8)", "10pq + 40q"], ["e", "-(-3p - q)", "3p + q", ["q + 3p"]], ["f", "-5(-3p + q)", "15p - 5q"] ] },
      { n: "L2", instr: "Werk de haakjes weg:", L: [
        ["a", "7(3b + 2c)", "21b + 14c"], ["b", "3f(2g + 5)", "6fg + 15f"], ["c", "2k(m + 5n)", "2km + 10kn"] ] },
      { n: "L3", instr: "Werk de haakjes weg:", page: 109, L: [
        ["a", "7(a - 3b)", "7a - 21b"], ["b", "-k(2l + 5)", "-2kl - 5k"], ["c", "-(6p - q)", "-6p + q", ["q - 6p"]] ] },
      { n: "18", instr: "Herleid:", page: 110, L: [
        ["a", "3(a + 2b) - 6a", "-3a + 6b", ["6b - 3a"]], ["b", "-5(a - 2b) + 6a", "a + 10b", ["10b + a"]],
        ["c", "5(a - 2b) + 3(2a - b)", "11a - 13b"], ["d", "8(a - b) - 5(a - 3)", "3a - 8b + 15"],
        ["e", "2a - (5 + 2a)", "-5"], ["f", "-3a(b - 1) - 3a", "-3ab"] ] },
      { n: "19", instr: "Herleid:", page: 110, L: [
        ["a", "7(x + y) - 2(3x - y) + 5x", "6x + 9y"], ["b", "3p - p(q + 3) + q(2 - p)", "-2pq + 2q", ["2q - 2pq"]],
        ["c", "-3(a - 6b) - 2ab - a(b - 4)", "a + 18b - 3ab"], ["d", "8y - 2x(y + 7) - y(x - 8)", "16y - 3xy - 14x"] ] },
      { n: "20", instr: "Herleid:", page: 110, L: [
        ["a", "-3x - 2y + x(y - 5)", "xy - 8x - 2y"], ["b", "5p(q + 3) - 2p · -3q", "11pq + 15p"],
        ["c", "2x(5y - 2) - 5x · 2y", "-4x"], ["d", "2p(q - 1) - (1 - 2p)", "2pq - 1"],
        ["e", "3a - 2a(3 - 5b) + b(1 - a)", "-3a + 9ab + b"], ["f", "-3p · -2q - q(6p + 1)", "-q"] ] },
    ],
  },
  {
    onderdeel: "8.3",
    titel: "§8.3 Machten",
    type: "machten",
    page: 115,
    opgaven: [
      { n: "33", instr: "Bereken:", L: [
        ["a", "2^5", "32"], ["b", "6^3", "216"], ["c", "10^5", "100000"], ["d", "2^6", "64"],
        ["e", "1^7", "1"], ["f", "0^8", "0"], ["g", "1^9999", "1"], ["h", "0^2000", "0"] ] },
      { n: "34", instr: "Bereken:", L: [
        ["a", "5^4", "625"], ["b", "3^4", "81"], ["c", "10^3", "1000"] ] },
      { n: "35", instr: "Vul in:", L: [
        ["a", "8 = 2^▢", "3"], ["b", "81 = 9^▢", "2"], ["c", "125 = ▢^3", "5"], ["d", "64 = 4^▢", "3"],
        ["e", "64 = ▢^6", "2"], ["f", "64 = ▢^2", "8"], ["g", "1000 = 10^▢", "3"], ["h", "27 = 3^▢", "3"],
        ["i", "169 = ▢^2", "13"], ["j", "1 = ▢^7", "1"], ["k", "32 = 2^▢", "5"], ["l", "0 = ▢^11", "0"] ] },
      { n: "L5", instr: "Bereken:", page: 116, L: [
        ["a", "2^7", "128"], ["b", "7^3", "343"], ["c", "1^111", "1"] ] },
      { n: "38", instr: "Bereken:", page: 117, L: [
        ["a", "2^5 - 5^2", "7"], ["b", "(2^3 + 3)^2", "121"], ["c", "12 - 6^2", "-24"],
        ["d", "6^2 : 3^2", "4"], ["e", "5 · (3 - 2)^3", "5"], ["f", "5 - 3 · 2^3", "-19"] ] },
      { n: "39", instr: "Schrijf als product van priemfactoren (gebruik machten):", page: 117, L: [
        ["a", "96", "2^5 · 3"], ["b", "360", "2^3 · 3^2 · 5"], ["c", "550", "2 · 5^2 · 11"],
        ["d", "875", "5^3 · 7"], ["e", "4410", "2 · 3^2 · 5 · 7^2"], ["f", "18000", "2^4 · 3^2 · 5^3"] ] },
      { n: "41", instr: "Bereken:", page: 118, L: [
        ["a", "(-2)^4", "16"], ["b", "-2^4", "-16"], ["c", "(-3)^3", "-27"], ["d", "-3^3", "-27"] ] },
      { n: "43", instr: "Bereken:", page: 118, L: [
        ["a", "5 + (-2)^4", "21"], ["b", "5 - 2^4", "-11"], ["c", "(-1)^6 - 3^3", "-26"],
        ["d", "1^2 - (-2)^3", "9"], ["e", "-2^6 - (-2)^6", "-128"], ["f", "(-3)^4 : 9 - 5^3", "-116"] ] },
      { n: "44", instr: "Bereken:", page: 118, L: [
        ["a", "-5 - (-2)^4", "-21"], ["b", "-5^2 - (-2)^5", "7"], ["c", "(5 · -2)^4", "10000"],
        ["d", "5 - (2 - 3)^6", "4"], ["e", "-3^4 + (-3)^4", "0"], ["f", "-1^4 + (-1)^5", "-2"],
        ["g", "32 : (-2)^5", "-1"], ["h", "6^3 - 2 · (-3)^2", "198"], ["i", "-5^2 - 3^2 · (-2)^3", "47"] ] },
      { n: "L6", instr: "Bereken:", page: 118, L: [
        ["a", "(-3)^4", "81"], ["b", "-3^4", "-81"], ["c", "(6 - 2)^3 : 16", "4"],
        ["d", "5^3 - 3 · 2^4", "77"], ["e", "16 - (5 - 7)^4", "0"], ["f", "-4 · (-1)^7 - 3^3", "-23"] ] },
      { n: "45", instr: "Bereken zonder rekenmachine:", page: 119, L: [
        ["h", "1^3 + 2^3 + 3^3 + 4^3 + 5^3", "225"], ["i", "5^3 + 6^3 + 7^3 + 8^3 + 9^3", "1925"] ] },
      { n: "46", instr: "Bereken:", page: 120, L: [
        ["a", "2,3 · 2,3 · 2,3 · 2,3", "27,9841", ["27.9841"]] ] },
      { n: "47", instr: "Bereken (rond af op twee decimalen):", page: 120, L: [
        ["a", "5,6^3", "175,62", ["175.62"]], ["b", "0,95^4 · 5,2", "4,24", ["4.24"]],
        ["c", "(-2,6)^4 - 1,7^3", "40,78", ["40.78"]], ["d", "0,58 · 2,5^3 - (-1,4)^3", "11,81", ["11.81"]],
        ["e", "(3,7 · 0,27)^5", "1,00", ["1.00", "1"]], ["f", "(4,7 - 2,8)^3 : (-1,8)^4", "0,65", ["0.65"]] ] },
      { n: "48", instr: "Bereken (rond af op twee decimalen):", page: 120, L: [
        ["a", "(1 3/7)^4", "4,16", ["4.16"]], ["b", "(2,1^3 - 8) : (1,5^4 - 3)", "0,61", ["0.61"]],
        ["c", "(2 1/3)^3 + (-1 1/6)^4", "14,56", ["14.56"]], ["d", "(-2,3)^5 : (3^2 - 1,3^4)", "-10,48", ["-10.48"]],
        ["e", "-5^4 : 7 : (3/4)^3", "-211,64", ["-211.64"]], ["f", "100 : (5 - 2,8^4)", "-1,77", ["-1.77"]] ] },
    ],
  },
  {
    onderdeel: "8.4",
    titel: "§8.4 De wetenschappelijke notatie",
    type: "wet-notatie",
    page: 123,
    opgaven: [
      { n: "54", instr: "Schrijf in de wetenschappelijke notatie:", exact: true, L: [
        ["a", "480000", "4,8 · 10^5", ["4.8*10^5"]], ["b", "900000000000", "9 · 10^11", ["9*10^11"]],
        ["c", "180000000", "1,8 · 10^8", ["1.8*10^8"]], ["d", "152500", "1,525 · 10^5", ["1.525*10^5"]],
        ["e", "158", "1,58 · 10^2", ["1.58*10^2"]], ["f", "5390", "5,39 · 10^3", ["5.39*10^3"]] ] },
    ],
  },
];

const APPENDIX = "raw/wiskunde/PXL_20260610_064323116.jpg"; // antwoorden-bijlage H8 (p104–123)
const opgaven = [];
for (const groep of DATA) {
  for (const o of groep.opgaven) {
    const page = o.page ?? groep.page;
    for (const [letter, vraagExpr, antwoord, accepted] of o.L) {
      opgaven.push({
        id: `wiskunde-h8-${groep.onderdeel}-${o.n}${letter}`,
        hoofdstuk: "8",
        onderdeel: groep.onderdeel,
        onderdeelTitel: groep.titel,
        opgavenummer: `${o.n}${letter}`,
        vraag: `${o.instr} ${vraagExpr}`,
        antwoord,
        ...(accepted ? { acceptedForms: accepted } : {}),
        type: groep.type,
        ...(o.exact ? { exacteVorm: true } : {}),
        isSynthese: false,
        bron: `raw/wiskunde/wiskunde-h08-p${page}.jpg`,
        antwoordBron: APPENDIX,
        confidence: 0.95,
        verifiedBy: "boek",
      });
    }
  }
}

const bestand = { vak: "wiskunde", normalisatie: "wiskunde", opgaven };
mkdirSync(dirname(UIT), { recursive: true });
writeFileSync(UIT, JSON.stringify(bestand, null, 2) + "\n");
const perOnderdeel = {};
for (const o of opgaven) perOnderdeel[o.onderdeel] = (perOnderdeel[o.onderdeel] ?? 0) + 1;
console.log(`Geschreven: ${opgaven.length} opgaven →`, UIT);
console.log("Per onderdeel:", perOnderdeel);
