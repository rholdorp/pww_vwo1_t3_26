// Genereert content/2026-t3/trainers/wiskunde/opgaven.json voor Hoofdstuk 8.
//
// Bron: lesboek-foto's (vraagteksten) + antwoorden-bijlage (eindantwoorden), beide
// uit content/2026-t3/raw/wiskunde/. Elke (vraag → antwoord)-paring is met de hand
// door BEREKENING geverifieerd (de opgave vereenvoudigt/evalueert tot het
// boek-antwoord) — P8: een fout antwoord traint een foute reflex, dus alleen
// geverifieerde, schone, zelfstandige opgaven. Bewust NIET opgenomen (gevlagd in
// docs/BACKLOG.md + manifest): figuur-opgaven, woordproblemen, opgaven met
// breuk-coëfficiënt-antwoorden (matcher-onveilig), en antwoorden die in het boek
// een tekening/uitwerking ("*") zijn. De bijlage-foto's dekken wél heel H8: opg 55+
// staan op PXL_…064343217 (p30) en PXL_…064345600.MP (p31) — de oude notitie
// "A55/L8 wachten op de antwoordfoto" was achterhaald (vastgesteld 2026-06-12).
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
  {
    // §8.5 toegevoegd 2026-06-12. Antwoorden uit de bijlage-foto's p30 (opg 55–70,
    // L8–L10) en p31 (opg 71–85, L11/L12, gemengd 1–4); elk antwoord daarnaast zelf
    // door berekening gecontroleerd. Overgeslagen (conventie, zie kop): 65 (piramide-
    // figuur), 66a + 73 (open uitleg-/bedenk-vragen), 67 (kubus-figuur), 76 (twee
    // invulvelden per item), 84a (breuk-coëfficiënt 4x^6/3, matcher-onveilig).
    // "k.n." (kan niet) is in het boek het afgesproken antwoord bij niet-gelijksoortige
    // termen (p128) — acceptedForms vangen "kan niet"/"kn" op.
    onderdeel: "8.5",
    titel: "§8.5 Machten en letters",
    type: "machten-letters",
    page: 125,
    antw: "raw/wiskunde/PXL_20260610_064343217.jpg", // bijlage p30: t/m opg 70 + L10
    opgaven: [
      { n: "60", instr: "Herleid:", L: [
        ["a", "5x · 2x", "10x^2"], ["b", "4x · x · 3x", "12x^3"], ["c", "2a · 5a · 3a · a", "30a^4"],
        ["d", "5p · -p · -p", "5p^3"], ["e", "4x · -x", "-4x^2"], ["f", "-b · 2b · -b · 2b", "4b^4"] ] },
      { n: "61", instr: "Herleid:", L: [
        ["a", "p^3 · p^4", "p^7"], ["b", "p^5 · p^3", "p^8"] ] },
      { n: "62", instr: "Herleid:", page: 126, L: [
        ["a", "b^5 · b^8", "b^13"], ["b", "x · x^4", "x^5"], ["c", "x^3 · x^5 · x", "x^9"],
        ["d", "x^5 · x · x · x^2", "x^9"], ["e", "p^8 · p^9", "p^17"], ["f", "p · p · p", "p^3"] ] },
      { n: "63", instr: "Herleid:", page: 126, L: [
        ["a", "2a^5 · 3a^7", "6a^12"], ["b", "8a^6 · -3a", "-24a^7"], ["c", "4m^6 · -2m^7", "-8m^13"],
        ["d", "-y^3 · 2y^9", "-2y^12"], ["e", "5p^4 · 2p^12 · -p^7", "-10p^23"], ["f", "4p^5 · q^6 · 3q", "12p^5q^7"] ] },
      { n: "64", instr: "Herleid:", page: 126, L: [
        ["a", "5x^3 · -2x^4 · -x", "10x^8"], ["b", "a · b^3 · a^6 · b^2", "a^7b^5"],
        ["c", "x^2y^3 · x^5y^2", "x^7y^5"], ["d", "2ab^3 · 5a^3b^2", "10a^4b^5"],
        ["e", "3p^6 · -3p^6", "-9p^12"], ["f", "6x^2 · -3y · 2y^5 · -2x", "72x^3y^6"] ] },
      { n: "66", instr: "Schrijf als één macht:", page: 127, L: [
        ["b", "3^8 · 3^11", "3^19"], ["c", "2^2 · 4^8", "4^9", ["2^18"]], ["d", "2^6 · 8", "2^9", ["8^3"]] ] },
      { n: "L10", instr: "Herleid:", page: 127, L: [
        ["a", "a^4 · a^7", "a^11"], ["b", "b^6 · b · b^3", "b^10"],
        ["c", "8c^3 · -c", "-8c^4"], ["d", "4p^4 · q^7 · 5p^5", "20p^9q^7"] ] },
      { n: "68", instr: "Herleid:", page: 128, L: [
        ["a", "7a^3 + 5a^3", "12a^3"], ["b", "3a^2 - 9a^2", "-6a^2"], ["c", "4a^4 - a^4", "3a^4"],
        ["d", "c^5 - 5c^5", "-4c^5"], ["e", "2y^2 + y^2", "3y^2"], ["f", "x^2 + x^2", "2x^2"],
        ["g", "6a + 8a", "14a"], ["h", "6a^2 - 8a^2", "-2a^2"], ["i", "2x^2 + 8x^2", "10x^2"] ] },
      { n: "69", instr: "Herleid (kan het niet, typ dan k.n.):", page: 128, L: [
        ["a", "8ab - 6ab", "2ab"], ["b", "13p^2 + p^2", "14p^2"], ["c", "5xy + 4xy", "9xy"],
        ["d", "xy - 8x", "k.n.", ["kan niet", "kn"]], ["e", "5a^3 + 5a^3", "10a^3"], ["f", "6x^6 - 7x^6", "-x^6"],
        ["g", "2x^2 + 8y^2 - 3x^2", "-x^2 + 8y^2", ["8y^2 - x^2"]],
        ["h", "8a^2 - 2b^3 - 7a^2", "a^2 - 2b^3", ["-2b^3 + a^2"]],
        ["i", "7a^3 + 3 + 5a^4", "k.n.", ["kan niet", "kn"]],
        ["j", "6a^2 - 10a + 7a^3", "k.n.", ["kan niet", "kn"]],
        ["k", "5x^2 - 5x^3 - 6x^2 + 11x^3", "-x^2 + 6x^3", ["6x^3 - x^2"]],
        ["l", "7q^3 + 5p - 5q^3 + 6q^3", "8q^3 + 5p", ["5p + 8q^3"]] ] },
      { n: "70", instr: "Herleid:", page: 128, L: [
        ["a", "2a^3 - 5a^3 + 7a^3", "4a^3"], ["b", "-x^2 - 2x^2 + 3x^3", "-3x^2 + 3x^3", ["3x^3 - 3x^2"]],
        ["c", "3p^4 - q^3 + p^4 - 2q^3", "4p^4 - 3q^3", ["-3q^3 + 4p^4"]],
        ["d", "4m^3 - 3m^5 - 4m^3 + m^4", "m^4 - 3m^5", ["-3m^5 + m^4"]],
        ["e", "ab + 7a - 6a - 3ab", "a - 2ab", ["-2ab + a"]],
        ["f", "-7 - y^5 + 8 - 2y^5", "1 - 3y^5", ["-3y^5 + 1"]] ] },
      { n: "71", instr: "Herleid (kan het niet, typ dan k.n.):", page: 128,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "3x^5 + 2x^5", "5x^5"], ["b", "3x^5 · 2x^5", "6x^10"], ["c", "5x^3 - 2x^5", "k.n.", ["kan niet", "kn"]],
        ["d", "5x^3 · 2x^5", "10x^8"], ["e", "x^3 + 2x^3", "3x^3"], ["f", "x^3 · 2x^3", "2x^6"],
        ["g", "-3x^4 + 3x^4", "0"], ["h", "-3x^4 · 3x^4", "-9x^8"], ["i", "-3x^4 - 3x^4", "-6x^4"] ] },
      { n: "72", instr: "Vul in wat er op de puntjes hoort:", page: 128,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "8x^6 + … = 12x^6", "4x^6"], ["b", "6x^4 · … = 12x^6", "2x^2"], ["c", "x · … = 12x^6", "12x^5"],
        ["d", "15x^6 - … = 12x^6", "3x^6"], ["e", "-2x^4 · … = 12x^6", "-6x^2"], ["f", "3x · … = 12x^6", "4x^5"] ] },
      { n: "74", instr: "Herleid:", page: 129,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "a^3 · a^2 + 3a^5", "4a^5"], ["b", "2a^4 · a^2 + 5a^3 · a^3", "7a^6"],
        ["c", "-7a^8 + 2a^2 · -3a^6", "-13a^8"], ["d", "8a^2 · 3a^5 - 2a^4 · -3a^3", "30a^7"] ] },
      { n: "75", instr: "Herleid:", page: 129,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "3a^2(a^4 + 2a)", "3a^6 + 6a^3", ["6a^3 + 3a^6"]],
        ["b", "5a(a^3 - 2a)", "5a^4 - 10a^2", ["-10a^2 + 5a^4"]],
        ["c", "-3a^2(a - 2) + 5a^2", "-3a^3 + 11a^2", ["11a^2 - 3a^3"]],
        ["d", "a^3(a^5 - a^4) - 3a^2 · 2a^6", "-5a^8 - a^7", ["-a^7 - 5a^8"]],
        ["e", "a^3(2a - 1) + a^2(a^2 - 3a)", "3a^4 - 4a^3", ["-4a^3 + 3a^4"]],
        ["f", "a^2(a^3 - 2a) - a^4(a - 1)", "a^4 - 2a^3", ["-2a^3 + a^4"]] ] },
      { n: "L11", instr: "Herleid (kan het niet, typ dan k.n.):", page: 129,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "2x^5 + 3x^5", "5x^5"], ["b", "5ab - 6ab", "-ab"], ["c", "5c^3 - 5", "k.n.", ["kan niet", "kn"]],
        ["d", "5p^2 - p^2", "4p^2"], ["e", "2a^3 + 3a^4 - 5a^3", "-3a^3 + 3a^4", ["3a^4 - 3a^3"]],
        ["f", "3x^2 + 5y^3 + 6x^2 - 4y^3", "9x^2 + y^3", ["y^3 + 9x^2"]] ] },
      { n: "77", instr: "Herleid:", page: 129,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "a^5 / a^3", "a^2"], ["b", "a^5 / a", "a^4"], ["c", "a^5 / a^4", "a", ["a^1"]] ] },
      { n: "78", instr: "Herleid:", page: 130,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "x^7 / x^3", "x^4"], ["b", "a^12 / a", "a^11"], ["c", "b^9 / b^2", "b^7"], ["d", "p^8 / p^8", "1"] ] },
      { n: "79", instr: "Herleid:", page: 130,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "3x^12 / x^7", "3x^5"], ["b", "-12b^7 / 4b^6", "-3b"],
        ["c", "6a^7 / 2a", "3a^6"], ["d", "24p^7 / 4p^7", "6"] ] },
      { n: "80", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "x^6y^5 / x^2y^3", "x^4y^2"], ["b", "3a^4b^11 / a^2b", "3a^2b^10"],
        ["c", "-14p^5q / 2pq", "-7p^4"], ["d", "18x^4y^8 / -6x^3y^5", "-3xy^3"] ] },
      { n: "81", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "-16x^12y^8 / -2x^3y^4", "8x^9y^4"], ["b", "21a^3b^5 / -7ab^3", "-3a^2b^2"],
        ["c", "-18p^12q / 9p^12q", "-2"], ["d", "-24x^9yz^4 / -8x^8z^4", "3xy"] ] },
      { n: "L12", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "a^13 / a^6", "a^7"], ["b", "20b^20 / 5b^5", "4b^15"],
        ["c", "12c^5 / -2c^5", "-6"], ["d", "x^4y^8 / xy^7", "x^3y"] ] },
      { n: "82", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "2p^2 · p^3 + p^5", "3p^5"], ["b", "p^2 + 2p^2 · p^5", "p^2 + 2p^7", ["2p^7 + p^2"]],
        ["c", "3p^4 - p^8 / p^4", "2p^4"] ] },
      { n: "83", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "a^8 / a^3 + 2a^5", "3a^5"], ["b", "a^9 / a^5 · 3a^3 - 7a^7", "-4a^7"],
        ["c", "12a^9 / 4a^3 + 2a^7 / a", "5a^6"] ] },
      { n: "84", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["b", "6a^4 + (7a^10 - 3a^10) / 2a^6", "8a^4"],
        ["c", "6a^13 / 2a^3 - 4a^2 · 5a^5", "3a^10 - 20a^7", ["-20a^7 + 3a^10"]] ] },
      { n: "85", instr: "Herleid:", page: 131,
        antw: "raw/wiskunde/PXL_20260610_064345600.MP.jpg", L: [
        ["a", "4a^6(5a^4 - 6a^7 / 2a^3)", "8a^10"],
        ["b", "(6p^9q^5 / 2p^3q^4) · (15p^15q^15 / 5p^5q^5)", "9p^16q^11"],
        ["c", "8y^6 / 2y · (6y^4 - 2y · 3y^4)", "24y^9 - 24y^10", ["-24y^10 + 24y^9"]] ] },
    ],
  },
];

const APPENDIX = "raw/wiskunde/PXL_20260610_064323116.jpg"; // antwoorden-bijlage H8 (p104–123)
const opgaven = [];
for (const groep of DATA) {
  for (const o of groep.opgaven) {
    const page = o.page ?? groep.page;
    const antwoordBron = o.antw ?? groep.antw ?? APPENDIX;
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
        antwoordBron,
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
