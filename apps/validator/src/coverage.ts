import { basename } from "node:path";
import type { Fact } from "./types.js";
import { normKey, gelijkenis } from "./normalize.js";
import { listRawImages } from "./rawExtractor.js";
import { ocrImage } from "./ocr.js";

/**
 * Onafhankelijke, KEYLESS validatie-laag o.b.v. macOS Vision OCR.
 *
 * OCR leest dezelfde screenshots met compleet andere technologie dan een
 * taalmodel — een écht onafhankelijke tweede waarnemer, volledig on-device.
 * Het levert losse tekstregels (geen NL↔vreemd-paren), dus we valideren
 * bidirectioneel op regel-/zijde-niveau i.p.v. op paren:
 *
 *  - REVERSE (ongegrond): elke trainer-zijde (NL én vreemd) moet ergens in de
 *    OCR-tekst voorkomen. Een zijde zonder match is ONGEGROND — de trainer
 *    beweert iets dat niet zichtbaar in de screenshots staat (hallucinated).
 *    Dit is het schone, harde FAIL-signaal.
 *
 *  - FORWARD (ongedekt): elke gedrukte OCR-regel hoort terug te komen in de
 *    trainer. Een regel die nergens matcht is _mogelijk_ gemiste stof. Dit is
 *    ruis-gevoelig (OCR pikt koppen, paginanummers en handschrift op), dus een
 *    review-aid, geen harde gate.
 *
 * Samen vangen de twee richtingen het leeuwendeel van wat de paar-diff deed —
 * zonder API-key. Wat we missen is de precieze koppeling bij een verkeerde
 * vertaling (mismatch): die verschijnt hier als ongegrond + ongedekt los van
 * elkaar i.p.v. als één gekoppelde mismatch.
 */

const DEKKING_DREMPEL = 0.75;
const MIN_LETTERS = 3;

export interface OngedekteRegel {
  regel: string;
  ruw: string;
  bron: string;
  besteMatch: string;
  score: number;
}

export interface OngegrondeZijde {
  id?: string;
  zijde: "nl" | "vreemd";
  tekst: string;
  besteMatch: string;
  score: number;
}

export interface CoverageResultaat {
  gescandeImages: number;
  beschouwdeRegels: number;
  gedekt: number;
  ongedekt: OngedekteRegel[];
  trainerZijden: number;
  gegrond: number;
  ongegrond: OngegrondeZijde[];
}

/** Verwijder OCR-opsommingstekens en witruimte aan het begin van een regel. */
export function schoonRegel(s: string): string {
  return s
    .replace(/^[\s•·●○◦*\-–—|]+/u, "")
    .replace(/^[Oo](?=\s)/, "")
    .trim();
}

function letterAantal(s: string): number {
  return (s.match(/\p{L}/gu) ?? []).length;
}

interface Kandidaat {
  norm: string;
  label: string;
}

/**
 * Beste gelijkenis van een genormaliseerde string met een lijst kandidaten.
 * Containment vangt regels die een kandidaat exact bevatten maar langer/korter
 * zijn door OCR-ruis (de Levenshtein-ratio zakt dan onterecht).
 */
function besteMatch(norm: string, kandidaten: Kandidaat[]): { label: string; score: number } {
  let beste = { label: "", score: 0 };
  for (const k of kandidaten) {
    if (k.norm.length === 0) continue;
    const bevat = norm.includes(k.norm) || k.norm.includes(norm);
    const score = bevat ? Math.max(0.9, gelijkenis(norm, k.norm)) : gelijkenis(norm, k.norm);
    if (score > beste.score) beste = { label: k.label, score };
  }
  return beste;
}

interface OcrRegel {
  norm: string;
  regel: string;
  ruw: string;
  bron: string;
}

/** Lees, schoon en dedupliceer de content-regels uit de OCR van alle screenshots. */
function verzamelOcrRegels(images: string[], ocr: (p: string) => string[]): OcrRegel[] {
  const gezien = new Set<string>();
  const regels: OcrRegel[] = [];
  for (const imagePath of images) {
    const bron = basename(imagePath);
    for (const ruw of ocr(imagePath)) {
      const regel = schoonRegel(ruw);
      if (letterAantal(regel) < MIN_LETTERS) continue;
      const norm = normKey(regel);
      if (norm.length === 0 || gezien.has(norm)) continue;
      gezien.add(norm);
      regels.push({ norm, regel, ruw, bron });
    }
  }
  return regels;
}

/** Bidirectionele OCR-validatie van een vak (zie module-docstring). */
export function coverageVoorVak(
  images: string[],
  ocr: (p: string) => string[],
  facts: Fact[],
): CoverageResultaat {
  const ocrRegels = verzamelOcrRegels(images, ocr);

  const zijKandidaten: Kandidaat[] = [];
  for (const f of facts) {
    zijKandidaten.push({ norm: normKey(f.bronKey), label: f.bronKey });
    zijKandidaten.push({ norm: normKey(f.bronValue), label: f.bronValue });
  }
  const regelKandidaten: Kandidaat[] = ocrRegels.map((r) => ({ norm: r.norm, label: r.regel }));

  // FORWARD: OCR-regel → trainer-zijde.
  const ongedekt: OngedekteRegel[] = [];
  let gedekt = 0;
  for (const r of ocrRegels) {
    const beste = besteMatch(r.norm, zijKandidaten);
    if (beste.score >= DEKKING_DREMPEL) gedekt++;
    else ongedekt.push({ regel: r.regel, ruw: r.ruw, bron: r.bron, besteMatch: beste.label, score: beste.score });
  }
  ongedekt.sort((a, b) => a.score - b.score);

  // REVERSE: trainer-zijde → OCR-regel.
  const ongegrond: OngegrondeZijde[] = [];
  let gegrond = 0;
  let trainerZijden = 0;
  for (const f of facts) {
    for (const [zijde, tekst] of [["nl", f.bronKey], ["vreemd", f.bronValue]] as const) {
      trainerZijden++;
      const beste = besteMatch(normKey(tekst), regelKandidaten);
      if (beste.score >= DEKKING_DREMPEL) {
        gegrond++;
      } else {
        ongegrond.push({
          ...(f.id !== undefined ? { id: f.id } : {}),
          zijde,
          tekst,
          besteMatch: beste.label,
          score: beste.score,
        });
      }
    }
  }
  ongegrond.sort((a, b) => a.score - b.score);

  return {
    gescandeImages: images.length,
    beschouwdeRegels: ocrRegels.length,
    gedekt,
    ongedekt,
    trainerZijden,
    gegrond,
    ongegrond,
  };
}

/** Convenience-wrapper: lijst de screenshots en draai de OCR-validatie voor een vak. */
export async function gatherCoverage(
  repoRoot: string,
  editie: string,
  vak: string,
  facts: Fact[],
): Promise<CoverageResultaat> {
  const images = await listRawImages(repoRoot, editie, vak);
  return coverageVoorVak(images, ocrImage, facts);
}
