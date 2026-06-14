import { applyResult, isDue, mastery, nieuwItem } from "@pww/trainer-engine";
import type { ItemProgress, LeitnerBox, Uitkomst } from "@pww/shared";
import type { GeplandBlok } from "@pww/planner-engine";

// Voortgang in localStorage, gesleuteld op naam-slug. Bij actieve Firestore-
// sync (zie firestoreSync.ts) wordt elke save doorgepushed naar de cloud en
// updates van andere devices automatisch teruggesynct. Zonder Firebase-config
// fungeert localStorage als enige opslag.

// Lazy import zodat progress.ts/trainer-engine geen statische Firebase-dependency
// hebben (bv. voor de validator-Node-runs).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pushSync: ((naam: string) => void) | null = null;
void import("./firestoreSync").then((m) => {
  pushSync = m.schedulePush;
});

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slug(naam: string): string {
  return (
    naam
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "gast"
  );
}

type Store = Record<string, ItemProgress>;

const key = (naam: string) => `pww-progress:${slug(naam)}`;

export function load(naam: string): Store {
  try {
    return JSON.parse(localStorage.getItem(key(naam)) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function save(naam: string, store: Store): void {
  localStorage.setItem(key(naam), JSON.stringify(store));
  pushSync?.(naam);
}

export function progressVoor(naam: string, itemId: string): ItemProgress {
  return load(naam)[itemId] ?? nieuwItem(itemId, vandaag());
}

export function record(naam: string, itemId: string, uitkomst: Uitkomst): void {
  const store = load(naam);
  const prev = store[itemId] ?? nieuwItem(itemId, vandaag());
  store[itemId] = applyResult(prev, uitkomst, vandaag());
  save(naam, store);
}

export function blokMastery(naam: string, ids: readonly string[]): number {
  const store = load(naam);
  return mastery(ids.map((id) => store[id] ?? nieuwItem(id, vandaag())));
}

/** Is er al minstens één item van dit blok ooit beantwoord (voor "deels" vs "open")? */
export function isGezien(naam: string, ids: readonly string[]): boolean {
  const store = load(naam);
  return ids.some((id) => store[id] !== undefined);
}

/** Vandaag als ISO-datum (YYYY-MM-DD) — gedeeld met de planner. */
export function vandaagISO(): string {
  return vandaag();
}

export function boxVoor(naam: string, itemId: string): LeitnerBox {
  return (load(naam)[itemId]?.box ?? 1) as LeitnerBox;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Volgorde voor een nieuwe sessie:
 *  - alleen items die vandaag "aan de beurt" zijn (Leitner `isDue`) — zo hoef je items
 *    die je net goed had niet meteen opnieuw te doen bij heropenen;
 *  - is alles al beheerst/niet-due, dan toch de hele set (review);
 *  - altijd geschud, zodat de volgorde elke keer anders is (anti-memorisatie).
 */
export function sessieVolgorde(naam: string, ids: readonly string[]): string[] {
  const store = load(naam);
  const t = vandaag();
  const due = ids.filter((id) => {
    const p = store[id];
    return !p || isDue(p, t);
  });
  return shuffle(due.length > 0 ? due : ids);
}

// ── Cat 2 (wiskunde-opgaven) — status per onderdeel (paragraaf) per blok ──────
// De Cat-2-engine pakt maar ~2 opgaven per onderdeel, dus Leitner-mastery over álle
// opgaven zou de voortgang onderschatten. We bewaren daarom per (blok, onderdeel) de
// bereikte status ("klaar" = ✓ / "deels"). Losse opgave-resultaten gaan wél óók via
// `record` (spaced repetition + gamification-punten).
const cat2Key = (naam: string) => `pww-cat2:${slug(naam)}`;
type Cat2Store = Record<string, "klaar" | "deels">; // sleutel: `${blokId}|${onderdeel}`

function laadCat2(naam: string): Cat2Store {
  try {
    return JSON.parse(localStorage.getItem(cat2Key(naam)) ?? "{}") as Cat2Store;
  } catch {
    return {};
  }
}
/** Leg de bereikte status van een onderdeel vast (klaar wint van deels). */
export function zetOnderdeelStatus(naam: string, blokId: string, onderdeel: string, status: "klaar" | "deels"): void {
  const s = laadCat2(naam);
  const k = `${blokId}|${onderdeel}`;
  if (s[k] === "klaar") return; // klaar nooit terugzetten
  s[k] = status;
  localStorage.setItem(cat2Key(naam), JSON.stringify(s));
  pushSync?.(naam);
}
/** Fractie onderdelen ✓ (klaar) van een Cat-2-blok. */
export function onderdeelMastery(naam: string, blokId: string, onderdelen: readonly string[]): number {
  if (onderdelen.length === 0) return 0;
  const s = laadCat2(naam);
  const klaar = onderdelen.filter((o) => s[`${blokId}|${o}`] === "klaar").length;
  return klaar / onderdelen.length;
}
/** Is er al een onderdeel van dit blok aangeraakt (klaar of deels)? */
export function onderdeelGezien(naam: string, blokId: string, onderdelen: readonly string[]): boolean {
  const s = laadCat2(naam);
  return onderdelen.some((o) => s[`${blokId}|${o}`] !== undefined);
}

// ── Schrijftrainer (Cat 4) — laatste score + concept per opdracht ────────────
const schrijfKey = (naam: string) => `pww-schrijf:${slug(naam)}`;

type SchrijfStore = Record<string, { score?: number; concept?: Record<string, string> }>;

function laadSchrijf(naam: string): SchrijfStore {
  try {
    return JSON.parse(localStorage.getItem(schrijfKey(naam)) ?? "{}") as SchrijfStore;
  } catch {
    return {};
  }
}
function bewaarSchrijf(naam: string, s: SchrijfStore): void {
  localStorage.setItem(schrijfKey(naam), JSON.stringify(s));
  pushSync?.(naam);
}
export function laatsteScore(naam: string, opdrachtId: string): number | undefined {
  return laadSchrijf(naam)[opdrachtId]?.score;
}
export function zetScore(naam: string, opdrachtId: string, score: number): void {
  const s = laadSchrijf(naam);
  s[opdrachtId] = { ...s[opdrachtId], score };
  bewaarSchrijf(naam, s);
}
export function laadConcept(naam: string, opdrachtId: string): Record<string, string> {
  return laadSchrijf(naam)[opdrachtId]?.concept ?? {};
}
export function bewaarConcept(naam: string, opdrachtId: string, concept: Record<string, string>): void {
  const s = laadSchrijf(naam);
  s[opdrachtId] = { ...s[opdrachtId], concept };
  bewaarSchrijf(naam, s);
}

// ── Dagplan (planner) — bevroren keuze van vandaag, zodat de teller stabiel is ──
const dagplanKey = (naam: string, datum: string) => `pww-plan:${slug(naam)}:${datum}`;

export function laadDagplan(naam: string, datum: string): string[] | null {
  try {
    const raw = localStorage.getItem(dagplanKey(naam, datum));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
export function bewaarDagplan(naam: string, datum: string, ids: string[]): void {
  localStorage.setItem(dagplanKey(naam, datum), JSON.stringify(ids));
}

// ── Dagschema (kalender) — bevroren snapshot van de geplande vak-blokken per dag,
// zodat de terugblik stabiel blijft (verleden wordt nooit herberekend). ──────────
const dagschemaKey = (naam: string, datum: string) => `pww-schema:${slug(naam)}:${datum}`;

export function laadDagschema(naam: string, datum: string): GeplandBlok[] | null {
  try {
    const raw = localStorage.getItem(dagschemaKey(naam, datum));
    return raw ? (JSON.parse(raw) as GeplandBlok[]) : null;
  } catch {
    return null;
  }
}
export function bewaarDagschema(naam: string, datum: string, blokken: GeplandBlok[]): void {
  localStorage.setItem(dagschemaKey(naam, datum), JSON.stringify(blokken));
  pushSync?.(naam); // dagschema = bron voor de dagdoel-bonus → mee syncen
}

/** Alle datums waarvoor een dagschema is bevroren (voor de dagdoel-bonus). */
export function dagschemaDatums(naam: string): string[] {
  const prefix = `pww-schema:${slug(naam)}:`;
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
  }
  return out;
}

export function huidigeNaam(): string | null {
  return localStorage.getItem("pww-naam");
}
export function zetNaam(naam: string): void {
  localStorage.setItem("pww-naam", naam.trim());
}
/** Wis de actieve naam (uitloggen). Voortgang in localStorage/Firestore blijft staan
 * onder de slug, dus opnieuw inloggen met dezelfde naam haalt alles terug. */
export function wisNaam(): void {
  localStorage.removeItem("pww-naam");
}
