// Gamification (SPEC §8). De append-only resultaten-log is de bron-van-waarheid die
// de trainers vanaf v0.1 schrijven; punten/streak/mijlpalen zijn een PURE afgeleide
// view daarover (+ huidige mastery). Beloon kwaliteit (mastery), niet "tijd in stoel";
// per blok telt het hoogste niveau (anti-grinding), niet de som van pogingen.

import { BLOKKEN, type Blok } from "./content";
import { blokStatus, duurMin } from "./planner";
import { slug, vandaagISO, laadDagschema, dagschemaDatums } from "./progress";

// Lazy import (zoals progress.ts) zodat gamification geen statische Firebase-dependency
// heeft. De resultaten-log is een bonus-bron (focus/streak) → moet mee gesynct worden.
let pushSync: ((naam: string) => void) | null = null;
void import("./firestoreSync").then((m) => {
  pushSync = m.schedulePush;
});

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
  pushSync?.(naam); // bonus-data (focus/streak) cross-device syncen
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

/**
 * Beloningen zijn privé-afspraken tussen Ralph en Stijn: alleen Stijn (en
 * test-gebruikers) krijgen de beloningsteksten te zien. Klasgenoten zien wél de
 * punten en mijlpaal-namen, maar niet de beloningen (Ralph 2026-06-12).
 */
export function toontBeloningen(naam: string): boolean {
  const s = slug(naam);
  return s === "stijn" || s === "stijn1" || s === "test" || s.startsWith("test-");
}

// Mijlpalen + beloningen, door Ralph vastgesteld met Stijn (2026-06-12).
// 9 stappen, max 1 beloning per dag (~65 pt/dag bij 3 blokken + bonussen): de
// eerste dagen elk één kleine stap zodat Stijn aanhaakt, daarna ±elke 2 dagen.
export const MIJLPALEN: Mijlpaal[] = [
  { naam: "Aftrap", drempel: 25, beloning: "€5 extra zakgeld (Revolut) 💶" },
  { naam: "Sprintje", drempel: 90, beloning: "IJsje eten in Duitsland, met een vriend of Lauren erbij 🍦" },
  { naam: "Brons", drempel: 170, beloning: "€10 tegoed game-kaartje 🎮" },
  { naam: "Volhouder", drempel: 260, beloning: "Zo laat gaan slapen als jij wilt — samen een gezellige avond! 🌙" },
  { naam: "Zilver", drempel: 350, beloning: "Bowlen met een vriend erbij 🎳" },
  { naam: "Doorzetter", drempel: 470, beloning: "Jij kiest wat of waar we gaan eten 🍽️" },
  { naam: "Goud", drempel: 650, beloning: "€15 extra zakgeld (cash of Revolut) 💶" },
  { naam: "Flapdrol", drempel: 850, beloning: "Lunchpauze Coffee Mundo ☕" },
  { naam: "Eindbaas", drempel: 1100, beloning: "Karten bij All-in 🏎️" },
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

export interface BeloningAdvies extends MijlpaalStand {
  /** Geschat aantal nog af te ronden blokken tot de volgende beloning. */
  blokken: number;
  /** Geschat aantal dagen daarvoor (à ~3 blokken/dag). */
  dagen: number;
}

/**
 * Vertaal "nog X pt" naar iets concreets voor Stijn: hoeveel blokken (en dagen)
 * nog tot de volgende beloning. Rekenregel: een afgerond blok levert gemiddeld
 * ~15 pt op (10–15 per blok ✓ + dagdoel-/focus-bonussen uitgesmeerd).
 */
export function beloningAdvies(naam: string): BeloningAdvies {
  const stand = mijlpaalStand(naam);
  const blokken = stand.volgende ? Math.max(1, Math.ceil(stand.restant / 15)) : 0;
  const dagen = stand.volgende ? Math.max(1, Math.ceil(blokken / 3)) : 0;
  return { ...stand, blokken, dagen };
}

// ── Tijdschatting per blok, zelfcorrigerend ─────────────────────────────────────
// `duurMin` (planner) is een vaste heuristiek. De resultaten-log weet hoe lang
// Stijns sessies écht duurden (duurSec) → per soort een correctiefactor
// (mediaan van werkelijk/geschat), zodat de minuten-indicaties met de praktijk
// meegroeien. Defensief: korte/afgebroken sessies en uitschieters tellen niet mee,
// pas corrigeren vanaf 3 metingen, factor geklemd op 0,5–2,5×.

function mediaan(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Correctiefactor per soort (sleutel "*" = alle soorten samen, als fallback). */
export function duurFactoren(naam: string): Record<string, number> {
  const perSoort: Record<string, number[]> = {};
  const alle: number[] = [];
  for (const r of laadLog(naam)) {
    if (!r.duurSec || r.duurSec < 90) continue; // <1,5 min: (half) afgebroken sessie
    const blk = blokById.get(r.blokId);
    if (!blk) continue;
    const ratio = r.duurSec / 60 / duurMin(blk);
    if (ratio < 0.2 || ratio > 6) continue; // uitschieter (tab open laten staan e.d.)
    (perSoort[r.soort] ??= []).push(ratio);
    alle.push(ratio);
  }
  const klem = (x: number) => Math.min(2.5, Math.max(0.5, x));
  const uit: Record<string, number> = {};
  for (const [soort, ratios] of Object.entries(perSoort)) {
    if (ratios.length >= 3) uit[soort] = klem(mediaan(ratios));
  }
  if (alle.length >= 3) uit["*"] = klem(mediaan(alle));
  return uit;
}

/** Geschatte duur (min) van een trainer-blok, gecorrigeerd met de log-factoren. */
export function geschatteMin(factoren: Record<string, number>, blok: Blok): number {
  const factor = factoren[blok.soort] ?? factoren["*"] ?? 1;
  return Math.max(4, Math.round(duurMin(blok) * factor));
}
