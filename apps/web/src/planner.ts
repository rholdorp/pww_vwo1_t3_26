import type { Blok, BlokSoort } from "./content";
import { blokMastery, isGezien, laatsteScore } from "./progress";

// PWW-rooster (SPEC §7, manifest.yaml). Bepaalt prioriteit: vak met de vroegste
// toets eerst. (Hardcoded uit content/2026-t3/manifest.yaml → pww.)
export const PWW_DATUM: Record<string, string> = {
  engels: "2026-06-29",
  biologie: "2026-06-30",
  nederlands: "2026-07-01",
  wiskunde: "2026-07-02",
  aardrijkskunde: "2026-07-02",
  frans: "2026-07-03",
  geschiedenis: "2026-07-03",
};

// Afvink-mastery-drempel per soort (SPEC §8: Cat1 80%, Cat3 60%, Cat4 70%).
const DREMPEL: Record<BlokSoort, number> = {
  woordjes: 0.8,
  invullen: 0.8,
  vertalen: 0.8,
  begrippen: 0.8,
  diagram: 0.8,
  uitlegvragen: 0.6,
  schrijven: 0.7,
};

export type BlokStatusKind = "open" | "deels" | "afgevinkt";

export interface BlokStatus {
  mastery: number; // 0..1
  status: BlokStatusKind;
}

export function blokStatus(naam: string, blok: Blok): BlokStatus {
  if (blok.soort === "schrijven") {
    const s = blok.opdrachtId ? laatsteScore(naam, blok.opdrachtId) : undefined;
    const mastery = s != null ? s / 10 : 0;
    const status: BlokStatusKind = s == null ? "open" : mastery >= DREMPEL.schrijven ? "afgevinkt" : "deels";
    return { mastery, status };
  }
  const mastery = blokMastery(naam, blok.ids);
  const drempel = DREMPEL[blok.soort] ?? 0.8;
  const status: BlokStatusKind =
    mastery >= drempel ? "afgevinkt" : isGezien(naam, blok.ids) ? "deels" : "open";
  return { mastery, status };
}

export function dagenTot(vandaagISO: string, datumISO: string): number {
  const a = Date.parse(`${vandaagISO}T00:00:00Z`);
  const b = Date.parse(`${datumISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface PlanItem {
  blok: Blok;
  status: BlokStatus;
  pwwDatum: string;
  dagenTotToets: number;
}

/**
 * Plan voor vandaag (SPEC §7): kies tot `max` nog-niet-afgevinkte blokken,
 * geprioriteerd op (1) vroegste PWW-toets, (2) laagste mastery, en gespreid over
 * vakken (round-robin) tegen sleur. Pure functie van content + voortgang + datum;
 * herbalanceert vanzelf als de voortgang verandert (slots blijven voorspelbaar).
 */
export function planVandaag(blokken: Blok[], naam: string, vandaagISO: string, max = 3): PlanItem[] {
  const kandidaten: PlanItem[] = blokken
    .map((blok) => {
      const pwwDatum = PWW_DATUM[blok.vak] ?? "2026-07-03";
      return { blok, status: blokStatus(naam, blok), pwwDatum, dagenTotToets: dagenTot(vandaagISO, pwwDatum) };
    })
    .filter((x) => x.status.status !== "afgevinkt")
    .sort(
      (a, b) => a.pwwDatum.localeCompare(b.pwwDatum) || a.status.mastery - b.status.mastery,
    );

  // Round-robin over vakken: pak beurt om beurt de beste kandidaat per vak.
  const perVak = new Map<string, PlanItem[]>();
  for (const k of kandidaten) {
    if (!perVak.has(k.blok.vak)) perVak.set(k.blok.vak, []);
    perVak.get(k.blok.vak)!.push(k);
  }
  // Vakken op vroegste toets.
  const vakken = [...perVak.keys()].sort((a, b) => (PWW_DATUM[a] ?? "").localeCompare(PWW_DATUM[b] ?? ""));
  const gekozen: PlanItem[] = [];
  let i = 0;
  while (gekozen.length < max && vakken.some((v) => (perVak.get(v)?.length ?? 0) > 0)) {
    const vak = vakken[i % vakken.length];
    const rij = perVak.get(vak);
    if (rij && rij.length > 0) gekozen.push(rij.shift()!);
    i++;
  }
  return gekozen;
}
