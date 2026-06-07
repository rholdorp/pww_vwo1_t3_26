// Gamification (SPEC §8). De append-only resultaten-log is de bron-van-waarheid die
// de trainers vanaf v0.1 schrijven; punten/streak/mijlpalen zijn een PURE afgeleide
// view daarover (+ huidige mastery). Beloon kwaliteit (mastery), niet "tijd in stoel";
// per blok telt het hoogste niveau (anti-grinding), niet de som van pogingen.

import { BLOKKEN } from "./content";
import { blokStatus } from "./planner";
import { slug, vandaagISO, laadDagschema, dagschemaDatums } from "./progress";

export interface Resultaat {
  afgerondOp: string; // ISO-timestamp
  datum: string; // ISO-datum (YYYY-MM-DD)
  blokId: string;
  vak: string;
  soort: string;
  mastery: number;
  afgevinkt: boolean;
  /** Aaneengesloten studietijd van deze sessie (sec) — voor de focus-bonus. */
  duurSec?: number;
}

/**
 * Focus-bonus (besluit Ralph 2026-06-07): beloon volgehouden aandacht.
 * ≥15 min aan één stuk → +5, ≥30 min → nog eens +10 (samen +15).
 */
export function focusPunten(duurSec: number): number {
  const min = duurSec / 60;
  return (min >= 15 ? 5 : 0) + (min >= 30 ? 10 : 0);
}

const logKey = (naam: string) => `pww-resultaten:${slug(naam)}`;

function laadLog(naam: string): Resultaat[] {
  try {
    return JSON.parse(localStorage.getItem(logKey(naam)) ?? "[]") as Resultaat[];
  } catch {
    return [];
  }
}

/** Append-only: leg het resultaat van één afgerond trainer-blok vast (SPEC §8). */
export function logResultaat(naam: string, r: Omit<Resultaat, "afgerondOp" | "datum">): void {
  const log = laadLog(naam);
  log.push({ ...r, afgerondOp: new Date().toISOString(), datum: vandaagISO() });
  localStorage.setItem(logKey(naam), JSON.stringify(log));
}

/** Activiteit per dag over de laatste 7 dagen (oud→vandaag): # afgeronde sessies van dit vak. */
export function activiteit7dagen(naam: string, vak: string): number[] {
  const vandaag = vandaagISO();
  const perDag = new Map<string, number>();
  for (const r of laadLog(naam)) if (r.vak === vak) perDag.set(r.datum, (perDag.get(r.datum) ?? 0) + 1);
  return Array.from({ length: 7 }, (_, i) => perDag.get(isoMinus(vandaag, 6 - i)) ?? 0);
}

// Confetti-burst bij dagdoel: 1× per dag.
const gevierdKey = (naam: string, datum: string) => `pww-gevierd:${slug(naam)}:${datum}`;
export function alGevierd(naam: string, datum: string): boolean {
  return localStorage.getItem(gevierdKey(naam, datum)) === "1";
}
export function zetGevierd(naam: string, datum: string): void {
  localStorage.setItem(gevierdKey(naam, datum), "1");
}

export interface Mijlpaal {
  naam: string;
  drempel: number;
  beloning: string;
}

// Standaard-mijlpalen (SPEC §8). Ouder-configureerbare beloningen: later.
export const MIJLPALEN: Mijlpaal[] = [
  { naam: "Brons", drempel: 100, beloning: "IJsje na het avondeten" },
  { naam: "Zilver", drempel: 300, beloning: "Zaterdagavond bowlen met een vriend" },
  { naam: "Goud", drempel: 600, beloning: "€15 extra zakgeld" },
  { naam: "Platina", drempel: 1000, beloning: "Concertje / dagje uit naar keuze" },
];

const blokById = new Map(BLOKKEN.map((b) => [b.id, b]));

function isoMinus(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Aaneengesloten dagen (vanaf vandaag terug) met minstens één afgeronde sessie.
 * Eén gemiste dag is gratis (freebie); vandaag mag nog "leeg" zijn zonder te breken.
 */
export function streakDagen(naam: string): number {
  const datums = new Set(laadLog(naam).map((r) => r.datum));
  const vandaag = vandaagISO();
  let streak = 0;
  let vrijGebruikt = false;
  for (let i = 0; i < 120; i++) {
    const d = isoMinus(vandaag, i);
    if (datums.has(d)) streak++;
    else if (i === 0) continue; // vandaag nog niet gedaan → niet breken
    else if (!vrijGebruikt) vrijGebruikt = true; // 1 freebie
    else break;
  }
  return streak;
}

/** Totaal aantal punten — pure afgeleide van huidige mastery + dagschema's + streak. */
export function totaalPunten(naam: string): number {
  let p = 0;
  const perVak = new Map<string, string[]>();
  for (const b of BLOKKEN) {
    const st = blokStatus(naam, b);
    if (st.status === "afgevinkt") p += st.mastery >= 0.9 ? 15 : 10;
    else if (st.status === "deels") p += 2;
    if (!perVak.has(b.vak)) perVak.set(b.vak, []);
    perVak.get(b.vak)!.push(st.status);
  }
  // Vak helemaal klaar → bonus.
  for (const [, sts] of perVak) if (sts.length && sts.every((s) => s === "afgevinkt")) p += 75;
  // Dagdoel: een dag waarvan álle geplande trainer-blokken afgevinkt zijn.
  for (const d of dagschemaDatums(naam)) {
    const trainerIds = (laadDagschema(naam, d) ?? []).flatMap((b) => b.trainerBlokIds);
    if (
      trainerIds.length &&
      trainerIds.every((id) => {
        const blk = blokById.get(id);
        return blk && blokStatus(naam, blk).status === "afgevinkt";
      })
    ) {
      p += 15;
    }
  }
  // Weekstreak: +50 per volle 7-daagse streak.
  p += Math.floor(streakDagen(naam) / 7) * 50;
  // Focus-bonus: volgehouden studietijd per sessie (SPEC §8 + besluit 2026-06-07).
  for (const r of laadLog(naam)) if (r.duurSec) p += focusPunten(r.duurSec);
  return p;
}

export interface MijlpaalStand {
  punten: number;
  huidige: Mijlpaal | null;
  volgende: Mijlpaal | null;
  restant: number; // punten tot de volgende mijlpaal
  fractie: number; // 0..1 voortgang binnen het huidige segment
}

export function mijlpaalStand(naam: string): MijlpaalStand {
  const punten = totaalPunten(naam);
  const huidige = [...MIJLPALEN].reverse().find((m) => punten >= m.drempel) ?? null;
  const volgende = MIJLPALEN.find((m) => punten < m.drempel) ?? null;
  const onder = huidige?.drempel ?? 0;
  const boven = volgende?.drempel ?? onder;
  const restant = volgende ? volgende.drempel - punten : 0;
  const fractie = boven > onder ? (punten - onder) / (boven - onder) : 1;
  return { punten, huidige, volgende, restant, fractie };
}
