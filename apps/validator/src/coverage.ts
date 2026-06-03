import { basename } from "node:path";
import type { Fact } from "./types.js";
import { normKey, gelijkenis } from "./normalize.js";
import { listRawImages } from "./rawExtractor.js";
import { ocrImage } from "./ocr.js";

/**
 * Onafhankelijke COVERAGE-laag.
 *
 * OCR levert losse tekstregels (geen woordparen), dus dit past niet op het
 * paar-gebaseerde raw↔trainer-diff. In plaats daarvan beantwoordt deze laag een
 * andere, complementaire vraag: "staat élke regel gedrukte boektekst ook ergens
 * in de trainer-content?" Een regel die nergens matcht, is mógelijk gemiste stof
 * en wordt ter review voorgelegd (P8: liever een vals alarm dan stille gaten).
 *
 * Het is bewust een review-aid, geen harde pass/fail op zichzelf: OCR pikt ook
 * koppen, paginanummers en uitlegtekst op die geen toetsbare paren zijn. De mens
 * bevestigt of een ongedekte regel echt ontbrekende stof is of slechts chrome.
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

export interface CoverageResultaat {
  gescandeImages: number;
  beschouwdeRegels: number;
  gedekt: number;
  ongedekt: OngedekteRegel[];
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

interface TrainerZijde {
  tekst: string;
  norm: string;
}

function trainerZijden(facts: Fact[]): TrainerZijde[] {
  const zijden: TrainerZijde[] = [];
  for (const f of facts) {
    zijden.push({ tekst: f.bronKey, norm: normKey(f.bronKey) });
    zijden.push({ tekst: f.bronValue, norm: normKey(f.bronValue) });
  }
  return zijden;
}

/** Beste gelijkenis van een genormaliseerde regel met een trainer-zijde. */
function besteDekking(norm: string, zijden: TrainerZijde[]): { tekst: string; score: number } {
  let beste = { tekst: "", score: 0 };
  for (const z of zijden) {
    if (z.norm.length === 0) continue;
    // Containment vangt regels die een trainer-zijde exact bevatten maar langer/
    // korter zijn door OCR-ruis (Levenshtein-ratio zakt dan onterecht).
    const bevat = norm.includes(z.norm) || z.norm.includes(norm);
    const score = bevat ? Math.max(0.9, gelijkenis(norm, z.norm)) : gelijkenis(norm, z.norm);
    if (score > beste.score) beste = { tekst: z.tekst, score };
  }
  return beste;
}

/**
 * Vergelijk de OCR van álle screenshots van een vak met de trainer-facts.
 * Distinct content-regels die geen trainer-zijde halen, komen in `ongedekt`.
 */
export function coverageVoorVak(images: string[], ocr: (p: string) => string[], facts: Fact[]): CoverageResultaat {
  const zijden = trainerZijden(facts);
  const gezien = new Map<string, OngedekteRegel | null>(); // norm → ongedekt-record of null (gedekt)

  for (const imagePath of images) {
    const bron = basename(imagePath);
    for (const ruw of ocr(imagePath)) {
      const regel = schoonRegel(ruw);
      if (letterAantal(regel) < MIN_LETTERS) continue;
      const norm = normKey(regel);
      if (norm.length === 0 || gezien.has(norm)) continue;

      const beste = besteDekking(norm, zijden);
      if (beste.score >= DEKKING_DREMPEL) {
        gezien.set(norm, null);
      } else {
        gezien.set(norm, { regel, ruw, bron, besteMatch: beste.tekst, score: beste.score });
      }
    }
  }

  const ongedekt: OngedekteRegel[] = [];
  let gedekt = 0;
  for (const record of gezien.values()) {
    if (record === null) gedekt++;
    else ongedekt.push(record);
  }
  ongedekt.sort((a, b) => a.score - b.score);

  return {
    gescandeImages: images.length,
    beschouwdeRegels: gezien.size,
    gedekt,
    ongedekt,
  };
}

/** Convenience-wrapper: lijst de screenshots en draai de OCR-coverage voor een vak. */
export async function gatherCoverage(
  repoRoot: string,
  editie: string,
  vak: string,
  facts: Fact[],
): Promise<CoverageResultaat> {
  const images = await listRawImages(repoRoot, editie, vak);
  return coverageVoorVak(images, ocrImage, facts);
}
