// Firestore-sync laag voor cross-device voortgang.
//
// Strategie (eenvoudig, last-write-wins — past bij v0.1):
//  - Bij naam-claim: één keer hydrateren vanuit Firestore (cloud overschrijft
//    localStorage als doc bestaat). Daarna realtime listener: Firestore-doc-
//    wijzigingen (van andere device) → localStorage update.
//  - Bij elke lokale save: debounced push naar Firestore (1.5s na laatste edit).
//  - "naam" in document data = self-attestation; rules blokkeren writes waar
//    request.resource.data.naam ≠ document-id.
//
// Geen Firebase config? Alle export-functies zijn no-ops. App blijft draaien
// op localStorage-only — dev-mode zonder Firebase ondersteund.

import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { slug } from "./progress";

const DEBOUNCE_MS = 1500;

const localKey = (s: string) => `pww-progress:${s}`;
const schrijfLocalKey = (s: string) => `pww-schrijf:${s}`;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingNaam: string | null = null;
let unsubscribe: Unsubscribe | null = null;
let lastIncomingSerialized: string | null = null;

interface ProgressDoc {
  naam: string;
  items?: Record<string, unknown>;
  schrijf?: Record<string, unknown>;
  updated?: unknown;
}

function readLocal(naam: string): {
  items: Record<string, unknown>;
  schrijf: Record<string, unknown>;
} {
  const s = slug(naam);
  let items: Record<string, unknown> = {};
  let schrijf: Record<string, unknown> = {};
  try {
    items = JSON.parse(localStorage.getItem(localKey(s)) ?? "{}");
  } catch {
    /* ignore */
  }
  try {
    schrijf = JSON.parse(localStorage.getItem(schrijfLocalKey(s)) ?? "{}");
  } catch {
    /* ignore */
  }
  return { items, schrijf };
}

function writeLocal(naam: string, data: ProgressDoc): void {
  const s = slug(naam);
  if (data.items) localStorage.setItem(localKey(s), JSON.stringify(data.items));
  if (data.schrijf)
    localStorage.setItem(schrijfLocalKey(s), JSON.stringify(data.schrijf));
}

/**
 * Pakt de huidige naam-doc en zet een live listener op. Cloud-state overschrijft
 * lokaal bij eerste hit; daarna wint elke push. Roep eenmaal aan bij naam-claim
 * (of bij app-boot als naam bekend is uit localStorage).
 */
export function startSync(naam: string): void {
  if (!firebaseEnabled || !db) return;
  const s = slug(naam);
  if (pendingNaam === s) return; // al actief
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  pendingNaam = s;
  lastIncomingSerialized = null;
  const ref = doc(db, "progress", s);
  unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as ProgressDoc;
      const serialized = JSON.stringify(data.items ?? {}) + "|" + JSON.stringify(data.schrijf ?? {});
      if (serialized === lastIncomingSerialized) return; // eigen echo
      lastIncomingSerialized = serialized;
      writeLocal(naam, data);
      // Notify React tree dat localStorage is bijgewerkt — App.tsx luistert.
      window.dispatchEvent(new CustomEvent("pww-progress-updated", { detail: { naam: s } }));
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn("[firestoreSync] onSnapshot error:", err);
    }
  );
}

export function stopSync(): void {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  pendingNaam = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

/**
 * Debounced push: roep aan na elke lokale save. Verzamelt edits binnen
 * DEBOUNCE_MS en doet één setDoc-merge.
 */
export function schedulePush(naam: string): void {
  if (!firebaseEnabled || !db) return;
  const s = slug(naam);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    pushNow(s).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[firestoreSync] push failed:", err);
    });
  }, DEBOUNCE_MS);
}

async function pushNow(s: string): Promise<void> {
  if (!db) return;
  const { items, schrijf } = readLocal(s);
  const serialized = JSON.stringify(items) + "|" + JSON.stringify(schrijf);
  // Onze eigen push komt straks terug via onSnapshot — markeren zodat we 'm niet
  // als "incoming" verwerken.
  lastIncomingSerialized = serialized;
  await setDoc(
    doc(db, "progress", s),
    {
      naam: s,
      items,
      schrijf,
      updated: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Forceer een directe push (bv. bij window unload). Negeer fouten. */
export function flushPush(naam: string): void {
  if (!firebaseEnabled || !db) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  pushNow(slug(naam)).catch(() => {
    /* fire-and-forget */
  });
}
