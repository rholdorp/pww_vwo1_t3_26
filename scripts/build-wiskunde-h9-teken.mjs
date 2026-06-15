// Genereert content/2026-t3/trainers/wiskunde/tekenopgaven.json — H9 teken-/doe-
// opgaven (afvinken, geen automatisch antwoord). Opdracht-teksten getrouw uit het
// lesboek (Voorkennis + §9.1), figuren door Ralph gecropt (…-teken.jpg). Het
// "werkblad" uit het boek bestaat hier niet → vervangen door "op papier".
// Draai: node scripts/build-wiskunde-h9-teken.mjs
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UIT = join(ROOT, "content/2026-t3/trainers/wiskunde/tekenopgaven.json");

const TITEL = { voorkennis: "Voorkennis: Loodlijnen", "9.1": "§9.1 Lijnsymmetrie" };
const BRON = { voorkennis: "raw/wiskunde/wiskunde-h09-p147.jpg", "9.1": "raw/wiskunde/wiskunde-h09-p148.jpg" };

// [paragraaf, opgave, vraag, heeftFiguur, tip?]
const DATA = [
  ["voorkennis", "1", "De figuur hiernaast: a Teken door punt P de lijn l die loodrecht op k staat (denk aan het rechte-hoekteken). b Teken door Q de loodlijn m op k. c Teken door R de lijn n zodat n ⊥ k. d Teken door P de lijn q zodat q ⊥ l.", true],
  ["9.1", "2", "a Teken in elk van de drie afbeeldingen de symmetrieassen. b Hoeveel symmetrieassen heeft elke afbeelding?", true],
  ["9.1", "4", "Hoeveel vierkantjes moet je minstens blauw kleuren zodat de figuur één symmetrieas heeft? Kleur die vierkantjes.", true],
  ["9.1", "5", "Samira vouwt een vierkant vel papier twee keer om en knipt het daarna twee keer door (zie figuur). Ze krijgt zo een aantal stukken papier. Hoeveel van die stukken zijn vierkanten?", true],
  ["9.1", "6", "Van drie symmetrische figuren is één helft getekend; de symmetrieas is rood. Maak de figuren op papier af.", true],
  ["9.1", "7", "△PQR wordt gespiegeld in lijn s (zie figuur). Teken op papier het beeld △P'Q'R'.", true],
  ["9.1", "8", "Rechthoek ABCD wordt gespiegeld in lijn s (zie figuur). a Teken op papier het beeld A'B'C'D'. b Controleer met je geodriehoek dat het spiegelbeeld ook een rechthoek is.", true],
  ["9.1", "9", "a Teken de punten A(-4, 0), B(0, -2) en D(-2, 3) en teken △ABD. b Teken lijn s door B en D; △ABD wordt in s gespiegeld. c Waar liggen de beelden van B en D? d △ABD is de helft van de symmetrische vierhoek ABA'D — teken die vierhoek.", false],
];

const opgaven = DATA.map(([paragraaf, opgave, vraag, heeftFiguur, tip]) => ({
  id: `wiskunde-h9-${paragraaf}-opg${opgave}`,
  hoofdstuk: "9",
  paragraaf,
  onderdeelTitel: TITEL[paragraaf],
  opgave,
  vraag,
  ...(heeftFiguur ? { afbeelding: `assets/wiskunde/h9/h9-${paragraaf}-opg${opgave}-teken.jpg` } : {}),
  ...(tip ? { tip } : {}),
  bron: BRON[paragraaf],
  confidence: 0.95,
}));

writeFileSync(UIT, JSON.stringify({ vak: "wiskunde", opgaven }, null, 2) + "\n");
console.log(`Geschreven: ${opgaven.length} teken-opgaven → ${UIT}`);
