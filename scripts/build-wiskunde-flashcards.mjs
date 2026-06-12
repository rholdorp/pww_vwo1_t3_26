// Genereert content/2026-t3/trainers/wiskunde/flashcards.json (H8 regel-kaarten +
// H9 meetkunde-concepten). Alle kaarten getrouw uit de boek-theorie (P8: niets
// verzonnen). modus "typen" = actief intypen (korte term), "kaart" = flip + zelf
// beoordelen (definities/zinnen). Draai: node scripts/build-wiskunde-flashcards.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UIT = join(ROOT, "content/2026-t3/trainers/wiskunde/flashcards.json");

// [vraag, antwoord, modus, onderdeel, bron, accepted?]
const H8 = [
  ["In de macht 5³: hoe heet het getal 5?", "grondtal", "typen", "§8.3 Machten", "wiskunde-h08-p114.jpg"],
  ["In de macht 5³: hoe heet het getal 3?", "exponent", "typen", "§8.3 Machten", "wiskunde-h08-p114.jpg"],
  ["Wat betekent de macht 5³ (schrijf als herhaald product)?", "5 · 5 · 5", "kaart", "§8.3 Machten", "wiskunde-h08-p114.jpg"],
  ["Wat is de volgorde van bewerkingen?", "1) haakjes  2) machten  3) vermenigvuldigen en delen (van links naar rechts)  4) optellen en aftrekken (van links naar rechts)", "kaart", "§8.3 Machten", "wiskunde-h08-p117.jpg"],
  ["Wat is het verschil tussen -2⁴ en (-2)⁴?", "-2⁴ = -(2·2·2·2) = -16 (alleen het grondtal 2 staat onder de macht). (-2)⁴ = (-2)·(-2)·(-2)·(-2) = 16 (de hele -2 staat onder de macht).", "kaart", "§8.3 Machten", "wiskunde-h08-p118.jpg"],
  ["Een macht (-a)ⁿ van een negatief grondtal is positief als de exponent n … is.", "even", "typen", "§8.3 Machten", "wiskunde-h08-p118.jpg"],
  ["Hoe ziet de wetenschappelijke notatie van een getal eruit?", "als a · 10^n, waarbij a een getal is met 1 ≤ a < 10 en n een geheel getal", "kaart", "§8.4 De wetenschappelijke notatie", "wiskunde-h08-p122.jpg"],
  ["Hoe werk je de haakjes weg in a(b + c)?", "ab + ac (vermenigvuldig a met élke term tussen de haakjes)", "kaart", "§8.2 Haakjes wegwerken", "wiskunde-h08-p107.jpg"],
  // §8.5 Machten en letters (theorie-kaders p125/p127/p130/p131, toegevoegd 2026-06-12)
  ["Hoe herleid je een product van machten met hetzelfde grondtal, bv. a⁵ · a²?", "tel de exponenten op, het grondtal blijft gelijk: a⁵ · a² = a⁷", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p125.jpg"],
  ["Wat doe je bij 5a⁵ · 3a³ met de getallen ervoor en met de exponenten?", "getallen vermenigvuldigen (5 · 3 = 15), exponenten optellen (5 + 3 = 8): 5a⁵ · 3a³ = 15a⁸", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p125.jpg"],
  ["Wat zijn gelijksoortige termen?", "termen waarin precies dezelfde letters met dezelfde exponenten voorkomen; alleen gelijksoortige termen kun je samennemen", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p127.jpg"],
  ["Kun je 5a³ + 2a⁴ herleiden? En 5a³ + 2a³?", "5a³ + 2a⁴ kan niet (geen gelijksoortige termen); 5a³ + 2a³ = 7a³", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p127.jpg"],
  ["Hoe herleid je een deling van machten met hetzelfde grondtal, bv. a⁵/a²?", "trek de exponenten van elkaar af, het grondtal blijft gelijk: a⁵/a² = a³", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p130.jpg"],
  ["Wat is a⁵/a⁵? En 8a⁵/2a⁵?", "a⁵/a⁵ = 1 (iets gedeeld door zichzelf) en 8a⁵/2a⁵ = 4", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p130.jpg"],
  ["Let op het verschil: wat is 3a³ + 5a³, wat is 3a³ · 5a³ en wat is a⁵/a³?", "optellen: 3a³ + 5a³ = 8a³ · vermenigvuldigen: 3a³ · 5a³ = 15a⁶ (exponenten optellen) · delen: a⁵/a³ = a² (exponenten aftrekken)", "kaart", "§8.5 Machten en letters", "wiskunde-h08-p131.jpg"],
];

const H9 = [
  // Voorkennis + §9.1 lijnsymmetrie
  ["Wat betekent de notatie k ⊥ m?", "k staat loodrecht op m.", "kaart", "Voorkennis: Loodlijnen", "wiskunde-h09-p147.jpg"],
  ["Hoe noem je een figuur waarvan de twee helften precies op elkaar passen als je hem dubbelvouwt?", "lijnsymmetrisch", "typen", "§9.1 Lijnsymmetrie", "wiskunde-h09-p148.jpg"],
  ["Hoe heet de lijn waarover je vouwt bij lijnsymmetrie (en welke andere naam heeft die lijn)?", "de symmetrieas; een andere naam is spiegelas", "kaart", "§9.1 Lijnsymmetrie", "wiskunde-h09-p148.jpg"],
  ["Wat zijn de twee helften van een lijnsymmetrische figuur ten opzichte van elkaar?", "elkaars spiegelbeeld", "kaart", "§9.1 Lijnsymmetrie", "wiskunde-h09-p148.jpg"],
  ["Bij spiegelen: hoe heet de figuur waar je vanuit gaat, en hoe heet de figuur die je erbij tekent?", "het origineel en het spiegelbeeld (beeld)", "kaart", "§9.1 Lijnsymmetrie", "wiskunde-h09-p151.jpg"],
  ["Wat geldt er bij de spiegeling van een punt P in de lijn s (twee eigenschappen)?", "origineel P en beeld P' liggen even ver van de spiegelas s, en het lijnstuk PP' staat loodrecht op de spiegelas", "kaart", "§9.1 Lijnsymmetrie", "wiskunde-h09-p151.jpg"],
  // §9.2 draai- en puntsymmetrie
  ["Wanneer heet een figuur draaisymmetrisch?", "als hij bij draaiing om een punt (over minder dan 360°) met zichzelf samenvalt", "kaart", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p154.jpg"],
  ["Hoe heet het punt waar je een draaisymmetrische figuur omheen draait?", "draaipunt", "typen", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p154.jpg"],
  ["Hoe bereken je de kleinste draaihoek van een figuur die in n stappen rondvalt?", "360° : n  (bv. 360° : 6 = 60°)", "kaart", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p154.jpg"],
  ["Wat is het verschil tussen lijnsymmetrie en draaisymmetrie?", "bij lijnsymmetrie vouw je langs een lijn; bij draaisymmetrie draai je om een punt", "kaart", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p155.jpg"],
  ["Wat is een regelmatige veelhoek?", "een veelhoek waarvan alle zijden even lang en alle hoeken even groot zijn", "kaart", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p155.jpg"],
  ["Wanneer heet een figuur puntsymmetrisch, en hoe heet dat punt?", "als er bij elk punt een tweede punt is waarbij M het midden van het verbindingslijnstuk is; M heet het punt van symmetrie", "kaart", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p156.jpg"],
  ["Puntsymmetrie is hetzelfde als draaisymmetrie met welke draaihoek?", "180°", "typen", "§9.2 Draai- en puntsymmetrie", "wiskunde-h09-p156.jpg", ["180"]],
  // §9.3 bijzondere driehoeken
  ["Wat is een gelijkbenige driehoek?", "een driehoek met twee gelijke zijden", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p161.jpg"],
  ["In een gelijkbenige driehoek heten de twee gelijke zijden de …", "benen", "typen", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p161.jpg"],
  ["In een gelijkbenige driehoek heet de zijde die geen been is de …", "basis", "typen", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p161.jpg"],
  ["In een gelijkbenige driehoek: hoe heten de hoeken aan de basis, en hoe heet de andere hoek?", "de hoeken aan de basis heten de basishoeken; de andere hoek heet de tophoek", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p161.jpg"],
  ["Wat geldt er voor de basishoeken van een gelijkbenige driehoek (en de omkering)?", "de basishoeken zijn even groot; en als twee hoeken van een driehoek even groot zijn, is die driehoek gelijkbenig", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p161.jpg"],
  ["Wat is een gelijkzijdige driehoek, en hoe groot is elke hoek?", "een driehoek met drie gelijke zijden; elke hoek is 180° : 3 = 60°", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p162.jpg"],
  ["Hoeveel symmetrieassen heeft een gelijkzijdige driehoek, en wat is zijn kleinste draaihoek?", "drie symmetrieassen; kleinste draaihoek 360° : 3 = 120°", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p162.jpg"],
  ["Wat is een rechthoekige driehoek?", "een driehoek met een hoek van 90°", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p162.jpg"],
  ["Hoeveel graden zijn de drie hoeken van een driehoek samen?", "180°", "typen", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p164.jpg", ["180"]],
  ["Hoeveel graden zijn de vier hoeken van een vierhoek samen?", "360°", "typen", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p166.jpg", ["360"]],
  ["Hoe groot is een gestrekte hoek?", "180°", "typen", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p166.jpg", ["180"]],
  ["Wat geldt er voor overstaande hoeken?", "overstaande hoeken zijn even groot", "kaart", "§9.3 Bijzondere driehoeken", "wiskunde-h09-p166.jpg"],
  // §9.4 bijzondere vierhoeken
  ["Wat is een parallellogram?", "een vierhoek waarvan beide paren overstaande zijden evenwijdig zijn", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p169.jpg"],
  ["Noem de vier eigenschappen van een parallellogram.", "1) puntsymmetrisch; 2) overstaande zijden even lang; 3) diagonalen delen elkaar middendoor; 4) overstaande hoeken even groot", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p169.jpg"],
  ["Wat is een ruit?", "een vierhoek waarvan alle zijden even lang zijn", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p171.jpg"],
  ["Noem de extra eigenschappen van een ruit (naast die van een parallellogram).", "de diagonalen zijn symmetrieassen; ze staan loodrecht op elkaar; ze delen de hoeken middendoor", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p171.jpg"],
  ["Is elke ruit een parallellogram?", "ja — een ruit is een bijzonder parallellogram (met bovendien alle zijden even lang), dus alle eigenschappen van een parallellogram gelden ook", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p171.jpg"],
  ["Wat is een trapezium?", "een vierhoek met minstens één paar evenwijdige zijden", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p173.jpg"],
  ["Wat is een gelijkbenig trapezium?", "een trapezium met één symmetrieas", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p173.jpg"],
  ["Wat is een vlieger?", "een vierhoek waarvan minstens één diagonaal symmetrieas is", "kaart", "§9.4 Bijzondere vierhoeken", "wiskunde-h09-p173.jpg"],
  // §9.5 Z- en F-hoeken
  ["Welke regel geldt voor Z-hoeken?", "in een Z-figuur zijn twee lijnen evenwijdig en zijn de Z-hoeken gelijk", "kaart", "§9.5 Z- en F-hoeken", "wiskunde-h09-p175.jpg"],
  ["Welke regel geldt voor F-hoeken?", "in een F-figuur zijn twee lijnen evenwijdig en zijn de F-hoeken gelijk", "kaart", "§9.5 Z- en F-hoeken", "wiskunde-h09-p177.jpg"],
  ["Waarvoor gebruik je Z-hoeken en F-hoeken?", "om hoeken te herkennen en te berekenen in figuren met evenwijdige lijnen", "kaart", "§9.5 Z- en F-hoeken", "wiskunde-h09-p177.jpg"],
  ["Welke regels mag je gebruiken bij het berekenen van hoeken?", "rechte hoek (90°), gestrekte hoek (180°), overstaande hoeken, hoekensom driehoek (180°), hoekensom vierhoek (360°), basishoeken, F-hoeken en Z-hoeken", "kaart", "§9.5 Z- en F-hoeken", "wiskunde-h09-p179.jpg"],
];

let n8 = 0;
let n9 = 0;
const kaarten = [];
for (const [vraag, antwoord, modus, onderdeel, bron, accepted] of H8) {
  kaarten.push({
    id: `wiskunde-h8-regel-${String(++n8).padStart(3, "0")}`,
    vraag, antwoord, modus, onderdeel, hoofdstuk: "8",
    bron: `raw/wiskunde/${bron}`, confidence: 0.9,
    ...(accepted ? { acceptedAnswers: accepted } : {}),
  });
}
for (const [vraag, antwoord, modus, onderdeel, bron, accepted] of H9) {
  kaarten.push({
    id: `wiskunde-h9-concept-${String(++n9).padStart(3, "0")}`,
    vraag, antwoord, modus, onderdeel, hoofdstuk: "9",
    bron: `raw/wiskunde/${bron}`, confidence: 0.9,
    ...(accepted ? { acceptedAnswers: accepted } : {}),
  });
}

const bestand = { vak: "wiskunde", normalisatie: "begrip", kaarten };
mkdirSync(dirname(UIT), { recursive: true });
writeFileSync(UIT, JSON.stringify(bestand, null, 2) + "\n");
console.log(`Geschreven: ${kaarten.length} flashcards (${n8} H8 + ${n9} H9) →`, UIT);
