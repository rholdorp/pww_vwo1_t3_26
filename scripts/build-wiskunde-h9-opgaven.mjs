// Voegt H9-meetkunde NUMERIEKE hoek-opgaven (Cat 2, mét figuur) toe aan
// content/2026-t3/trainers/wiskunde/opgaven.json. Klein, VOLLEDIG zelf-geverifieerd
// (P8): per opgave de echte vraagtekst (lesboek p167), de schone vraag-figuur
// (bijgesneden uit de lesboekpagina, gecontroleerd) en het boek-antwoord uit de
// antwoorden-bijlage (PXL p41, opg 41/42/43) — plus een eigen geometrie-controle.
// Onderdeel = §9.3 Bijzondere driehoeken (hoeken berekenen). Antwoorden in graden,
// zonder ° (de matcher negeert het °-teken). Draai NA build-wiskunde-h8.mjs:
//   node scripts/build-wiskunde-h8.mjs && node scripts/build-wiskunde-h9-opgaven.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAD = join(ROOT, "content/2026-t3/trainers/wiskunde/opgaven.json");
const ANTW = "raw/wiskunde/PXL_20260610_064423657.jpg";

// Per opgave: nummer, gegeven (in de vraag herhaald + evt. zichtbaar in de figuur),
// optionele figuur (`fig`), bronpagina, en de te berekenen hoeken [label, antwoord°].
// Zonder `fig` → tekstopgave (gegevens staan in de tekst, geen figuur nodig).
const OPGAVEN = [
  {
    n: "41", gegeven: "ST = QT, ∠Q = 70° en ∠R = 68°", fig: "fig-h9-opg41.jpg", bron: "raw/wiskunde/wiskunde-h09-p167.jpg",
    hoeken: [["∠S₃", "70"], ["∠T₂", "40"], ["∠S₁", "55"], ["∠P", "42"], ["∠U₂", "97"]],
  },
  {
    n: "42", gegeven: "∠A₂ = 20°, ∠B = 75°, AD ⊥ BC en AE = CE", fig: "fig-h9-opg42.jpg", bron: "raw/wiskunde/wiskunde-h09-p167.jpg",
    hoeken: [["∠A₁", "15"], ["∠E₁", "140"], ["∠C₂", "50"]],
  },
  {
    n: "43", gegeven: "∠C₁ = ∠C₂, ∠E = 48°, ∠G = 90° en AC = CD", fig: "fig-h9-opg43.jpg", bron: "raw/wiskunde/wiskunde-h09-p167.jpg",
    hoeken: [["∠D₂", "111"], ["∠F₂", "117"]],
  },
  // Tekstopgaven (zonder figuur) — gelijkbenige driehoek, gegevens in de tekst.
  {
    n: "33", gegeven: "in △DEF is DF = EF en ∠D = 68°", bron: "raw/wiskunde/wiskunde-h09-p164.jpg",
    hoeken: [["∠E", "68"], ["∠F", "44"]],
  },
  {
    n: "34", gegeven: "in △ABC is AC = BC en ∠A = 35°", bron: "raw/wiskunde/wiskunde-h09-p164.jpg",
    hoeken: [["∠B", "35"], ["∠C", "110"]],
  },
];

const nieuw = [];
for (const o of OPGAVEN) {
  for (const [label, antwoord] of o.hoeken) {
    const slug = label.replace(/[∠]/g, "").replace(/[₀-₉]/g, (d) => "0123456789"["₀₁₂₃₄₅₆₇₈₉".indexOf(d)]);
    const zieFig = o.fig ? " (zie figuur)" : "";
    nieuw.push({
      id: `wiskunde-h9-9.3-${o.n}-${slug}`,
      hoofdstuk: "9",
      onderdeel: "9.3",
      onderdeelTitel: "§9.3 Bijzondere driehoeken",
      opgavenummer: `${o.n} (${label})`,
      vraag: `Gegeven${zieFig}: ${o.gegeven}. Bereken ${label} in graden.`,
      antwoord,
      type: "hoeken",
      ...(o.fig ? { afbeelding: `assets/wiskunde/h9/${o.fig}` } : {}),
      isSynthese: false,
      bron: o.bron,
      antwoordBron: ANTW,
      confidence: 0.95,
      verifiedBy: "boek",
    });
  }
}

const bestand = JSON.parse(readFileSync(PAD, "utf8"));
bestand.opgaven = bestand.opgaven.filter((o) => o.hoofdstuk !== "9").concat(nieuw);
writeFileSync(PAD, JSON.stringify(bestand, null, 2) + "\n");
console.log(`H9 toegevoegd: ${nieuw.length} hoek-opgaven. Totaal in opgaven.json: ${bestand.opgaven.length}.`);
