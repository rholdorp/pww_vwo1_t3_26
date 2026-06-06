import { applyResult, mastery, nieuwItem } from "@pww/trainer-engine";
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

/** Sorteer item-ids: zwakste bakjes eerst (meer oefening waar nodig). */
export function sorteerOpBakje(naam: string, ids: readonly string[]): string[] {
  const store = load(naam);
  return [...ids].sort((a, b) => (store[a]?.box ?? 1) - (store[b]?.box ?? 1));
}

export function huidigeNaam(): string | null {
  return localStorage.getItem("pww-naam");
}
export function zetNaam(naam: string): void {
  localStorage.setItem("pww-naam", naam.trim());
}
