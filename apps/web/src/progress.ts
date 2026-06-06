import { applyResult, isDue, mastery, nieuwItem } from "@pww/trainer-engine";
import type { ItemProgress, LeitnerBox, Uitkomst } from "@pww/shared";

// v0.1-prototype: voortgang in localStorage, gesleuteld op naam-slug (dezelfde
// sleutel-aanpak als de latere Firestore-sync uit SPEC §9). Nog geen cross-device.

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

export function huidigeNaam(): string | null {
  return localStorage.getItem("pww-naam");
}
export function zetNaam(naam: string): void {
  localStorage.setItem("pww-naam", naam.trim());
}
