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
const BRON = "raw/wiskunde/wiskunde-h09-p167.jpg";
const ANTW = "raw/wiskunde/PXL_20260610_064423657.jpg";

// Per opgave: nummer, gegeven (in de vraag herhaald + zichtbaar in de figuur),
// figuur, en de te berekenen hoeken [label, antwoord-in-graden].
const OPGAVEN = [
  {
    n: "41", gegeven: "ST = QT, ∠Q = 70° en ∠R = 68°", fig: "fig-h9-opg41.jpg",
    hoeken: [["∠S₃", "70"], ["∠T₂", "40"], ["∠S₁", "55"], ["∠P", "42"], ["∠U₂", "97"]],
  },
  {
    n: "42", gegeven: "∠A₂ = 20°, ∠B = 75°, AD ⊥ BC en AE = CE", fig: "fig-h9-opg42.jpg",
    hoeken: [["∠A₁", "15"], ["∠E₁", "140"], ["∠C₂", "50"]],
  },
  {
    n: "43", gegeven: "∠C₁ = ∠C₂, ∠E = 48°, ∠G = 90° en AC = CD", fig: "fig-h9-opg43.jpg",
    hoeken: [["∠D₂", "111"], ["∠F₂", "117"]],
  },
];

const nieuw = [];
for (const o of OPGAVEN) {
  for (const [label, antwoord] of o.hoeken) {
    const slug = label.replace(/[∠]/g, "").replace(/[₀-₉]/g, (d) => "0123456789"["₀₁₂₃₄₅₆₇₈₉".indexOf(d)]);
    nieuw.push({
      id: `wiskunde-h9-9.3-${o.n}-${slug}`,
      hoofdstuk: "9",
      onderdeel: "9.3",
      onderdeelTitel: "§9.3 Bijzondere driehoeken",
      opgavenummer: `${o.n} (${label})`,
      vraag: `Gegeven (zie figuur): ${o.gegeven}. Bereken ${label} in graden.`,
      antwoord,
      type: "hoeken",
      afbeelding: `assets/wiskunde/h9/${o.fig}`,
      isSynthese: false,
      bron: BRON,
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
