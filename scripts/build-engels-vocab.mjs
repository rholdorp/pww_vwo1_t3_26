// Genereert de definitie→woord-vocabkaarten (Words unit 4 & 5) en injecteert ze in
// content/2026-t3/trainers/engels/flashcards.json. Stijns toets vraagt vaak: Engelse
// definitie gegeven → vul het Engelse woord in (zijn zwakke plek). Bron: de officiële
// boek-woordenlijst (raw/engels/wordlist-insight-elementary.pdf) — P8: definities komen
// LETTERLIJK uit het boek, niet verzonnen. De voorbeeldzin (na ": ") wordt weggelaten en
// het kopwoord wordt in de definitie gemaskeerd (___), zodat het antwoord niet weglekt.
//
// Idempotent: bestaande engels-voc-* kaarten worden vervangen; de met de hand
// geschreven grammaticakaarten blijven staan. Draai: node scripts/build-engels-vocab.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PDF = join(ROOT, "content/2026-t3/raw/engels/wordlist-insight-elementary.pdf");
const KAARTEN = join(ROOT, "content/2026-t3/trainers/engels/flashcards.json");
const BRON = "raw/engels/wordlist-insight-elementary.pdf";
const CHUNK = 16;

const ruw = execFileSync("pdftotext", [PDF, "-"], { encoding: "utf8" });
// Lopende pagina-headers/footers strippen die anders aan een kopwoord vastplakken
// (bv. "Wordlist flower", "Oxford University Press coffee").
const txt = ruw.replace(/\bWordlist\b/g, " ").replace(/Oxford University Press/g, " ");
const lines = txt.split("\n");
const blok = (a, b) => lines.slice(lines.indexOf(a) + 1, lines.indexOf(b)).join("\n");

// Eén entry = "woord (pos) ​/fonetiek/ ​rest".   = en-space, ​ = zero-width.
const PAT = /([A-Za-z][A-Za-z’' \-]*?) \((n|v|adj|adv|prep|phr v|exp|pron|det|conj|number|abbr)\) ​\/([^/]*)\/ ​/g;

function entries(blkText) {
  const s = blkText.replace(/\n/g, " ");
  const ms = [...s.matchAll(PAT)];
  return ms.map((m, i) => {
    const rest = s.slice(m.index + m[0].length, i + 1 < ms.length ? ms[i + 1].index : s.length).trim();
    // Kopwoorden zijn 1–3 woorden; langer = ingelekte voorbeeldzin (ontbrekende punt
    // in de OCR) → houd de laatste 2 woorden (de echte samenstelling).
    let woord = m[1].trim();
    const ws = woord.split(/\s+/);
    if (ws.length > 3) woord = ws.slice(-2).join(" ");
    return { woord, pos: m[2], rest };
  });
}

// Definitie = alles vóór de voorbeeldzin. Meestal staat die na ": "; soms (geen ":")
// na de eerste zin-punt → neem de eerste zin(nen) en laat de laatste (voorbeeld) weg.
function definitie(woord, rest) {
  let def;
  if (rest.includes(": ")) {
    def = rest.split(": ")[0];
  } else {
    const zinnen = rest.split(". ");
    def = zinnen.length > 1 ? zinnen.slice(0, -1).join(". ") : rest;
  }
  def = def.replace(/\s+/g, " ").trim().replace(/[.;,:]+$/, "");
  // Maskeer het kopwoord (en bij samenstellingen elk deelwoord van ≥3 letters) +
  // simpele vervoegingen, zodat het antwoord niet via de definitie weglekt.
  const vormen = new Set();
  for (const deel of woord.replace(/[^A-Za-z ]/g, "").split(/\s+/)) {
    if (deel.length < 3) continue;
    vormen.add(deel).add(`${deel}s`).add(`${deel}es`).add(`${deel}ing`).add(`${deel}ed`);
    if (deel.endsWith("e")) vormen.add(`${deel.slice(0, -1)}ing`);
    if (deel.endsWith("y")) vormen.add(`${deel.slice(0, -1)}ies`);
  }
  for (const v of [...vormen].sort((a, b) => b.length - a.length)) {
    def = def.replace(new RegExp(`\\b${v}\\b`, "gi"), "___");
  }
  return def.replace(/\s+/g, " ").trim();
}

const slug = (w) => w.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const kaarten = [];
for (const unit of [4, 5]) {
  const es = entries(blok(`Unit ${unit}`, `Unit ${unit + 1}`));
  const chunks = Math.ceil(es.length / CHUNK);
  es.forEach((e, idx) => {
    const deel = chunks > 1 ? ` (${Math.floor(idx / CHUNK) + 1}/${chunks})` : "";
    kaarten.push({
      id: `engels-voc-u${unit}-${slug(e.woord)}`,
      vraag: `${definitie(e.woord, e.rest)} (${e.pos})`,
      antwoord: e.woord,
      modus: "typen",
      onderdeel: `Woorden unit ${unit} — definitie → woord${deel}`,
      hoofdstuk: String(unit),
      bron: BRON,
      confidence: 0.9,
    });
  });
}

const bestand = JSON.parse(readFileSync(KAARTEN, "utf8"));
const grammatica = bestand.kaarten.filter((k) => !k.id.startsWith("engels-voc-"));
bestand.kaarten = [...grammatica, ...kaarten];
writeFileSync(KAARTEN, JSON.stringify(bestand, null, 2) + "\n");
console.log(`Vocab geïnjecteerd: ${kaarten.length} definitie→woord kaarten (grammatica behouden: ${grammatica.length}).`);
