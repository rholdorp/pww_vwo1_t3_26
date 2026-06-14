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
// Bonus-bronnen (punten = SPEC §8): de gamification-log (focus/streak), de Cat-2-
// onderdeelstatus (wiskunde-opgaven) en de bevroren dagschema's (dagdoel-bonus).
const resultatenLocalKey = (s: string) => `pww-resultaten:${s}`;
const cat2LocalKey = (s: string) => `pww-cat2:${s}`;
const schemaPrefix = (s: string) => `pww-schema:${s}:`;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingNaam: string | null = null;
let unsubscribe: Unsubscribe | null = null;
let lastIncomingSerialized: string | null = null;

interface Resultaat {
  afgerondOp: string;
  blokId: string;
  [k: string]: unknown;
}

interface ProgressDoc {
  naam: string;
  items?: Record<string, unknown>;
  schrijf?: Record<string, unknown>;
  /** Append-only gamification-log (focus-bonus + streak). */
  resultaten?: Resultaat[];
  /** Cat-2 onderdeelstatus per blok: `${blokId}|${onderdeel}` → "klaar"|"deels". */
  cat2?: Record<string, string>;
  /** Bevroren dagschema's: ISO-datum → geplande blokken (dagdoel-bonus). */
  dagschema?: Record<string, unknown>;
  updated?: unknown;
}

interface LocalState {
  items: Record<string, unknown>;
  schrijf: Record<string, unknown>;
  resultaten: Resultaat[];
  cat2: Record<string, string>;
  dagschema: Record<string, unknown>;
}

function parse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readLocal(naam: string): LocalState {
  const s = slug(naam);
  const dagschema: Record<string, unknown> = {};
  const pre = schemaPrefix(s);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(pre)) dagschema[k.slice(pre.length)] = parse(localStorage.getItem(k), null);
  }
  return {
    items: parse(localStorage.getItem(localKey(s)), {}),
    schrijf: parse(localStorage.getItem(schrijfLocalKey(s)), {}),
    resultaten: parse(localStorage.getItem(resultatenLocalKey(s)), [] as Resultaat[]),
    cat2: parse(localStorage.getItem(cat2LocalKey(s)), {} as Record<string, string>),
    dagschema,
  };
}

/** Union van twee gamification-logs, dedupe op (afgerondOp|blokId) — géén puntverlies. */
function mergeResultaten(a: Resultaat[], b: Resultaat[]): Resultaat[] {
  const seen = new Set<string>();
  const out: Resultaat[] = [];
  for (const r of [...a, ...b]) {
    const key = `${r.afgerondOp}|${r.blokId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function writeLocal(naam: string, data: ProgressDoc): void {
  const s = slug(naam);
  // items + schrijf: cloud hydrateert (overschrijven, bestaand gedrag).
  if (data.items) localStorage.setItem(localKey(s), JSON.stringify(data.items));
  if (data.schrijf) localStorage.setItem(schrijfLocalKey(s), JSON.stringify(data.schrijf));
  // resultaten: UNION met lokaal zodat geen enkele bonus-sessie verloren gaat.
  if (data.resultaten) {
    const lokaal = parse(localStorage.getItem(resultatenLocalKey(s)), [] as Resultaat[]);
    localStorage.setItem(resultatenLocalKey(s), JSON.stringify(mergeResultaten(lokaal, data.resultaten)));
  }
  // cat2: merge per onderdeel, "klaar" wint nooit terug naar "deels".
  if (data.cat2) {
    const lokaal = parse(localStorage.getItem(cat2LocalKey(s)), {} as Record<string, string>);
    const samen = { ...lokaal };
    for (const [k, v] of Object.entries(data.cat2)) if (samen[k] !== "klaar") samen[k] = v;
    localStorage.setItem(cat2LocalKey(s), JSON.stringify(samen));
  }
  // dagschema: per datum terugschrijven (bevroren snapshots; niet overschrijven als al aanwezig).
  if (data.dagschema) {
    for (const [datum, blokken] of Object.entries(data.dagschema)) {
      const k = `${schemaPrefix(s)}${datum}`;
      if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(blokken));
    }
  }
}

/** Stabiele serialisatie van alle gesyncte velden (voor echo-detectie). */
function serialize(d: Partial<LocalState>): string {
  return [d.items ?? {}, d.schrijf ?? {}, d.resultaten ?? [], d.cat2 ?? {}, d.dagschema ?? {}]
    .map((x) => JSON.stringify(x))
    .join("|");
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
      const serialized = serialize(data);
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
  const local = readLocal(s);
  // Onze eigen push komt straks terug via onSnapshot — markeren zodat we 'm niet
  // als "incoming" verwerken.
  lastIncomingSerialized = serialize(local);
  await setDoc(
    doc(db, "progress", s),
    {
      naam: s,
      items: local.items,
      schrijf: local.schrijf,
      resultaten: local.resultaten,
      cat2: local.cat2,
      dagschema: local.dagschema,
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
