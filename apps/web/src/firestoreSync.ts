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
// Handmatige afvink-items (offline werk: wiskunde-boekoefeningen, handvaardigheid).
const afvinkLocalKey = (s: string) => `pww-afvink:${s}`;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingNaam: string | null = null;
let unsubscribe: Unsubscribe | null = null;
let lastIncomingSerialized: string | null = null;
// Anti-clobber: we pushen NIET voordat de cloud-staat één keer door de server is
// bevestigd. Anders kan een vers/leeg device (geen lokale voortgang) bij het
// opstarten een lege `items` over de cloud schrijven en alle voortgang wissen.
let hydrated = false;
let deferredPush = false;

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
  /** Handmatige afvink-items: item-id → true (offline werk, dagdoel-bonus). */
  afvink?: Record<string, boolean>;
  updated?: unknown;
}

interface LocalState {
  items: Record<string, unknown>;
  schrijf: Record<string, unknown>;
  resultaten: Resultaat[];
  cat2: Record<string, string>;
  dagschema: Record<string, unknown>;
  afvink: Record<string, boolean>;
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
    afvink: parse(localStorage.getItem(afvinkLocalKey(s)), {} as Record<string, boolean>),
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

type ItemRec = { box?: number; laatstGezien?: string; aantalGoed?: number; aantalFout?: number };

/** Kies van twee versies van hetzelfde item de "rijkste": meeste antwoorden (= meest
 * complete historie), dan recentste datum, dan hoogste box. We gooien nooit voortgang weg. */
function beterItem(a: ItemRec, b: ItemRec): ItemRec {
  const ta = (a.aantalGoed ?? 0) + (a.aantalFout ?? 0);
  const tb = (b.aantalGoed ?? 0) + (b.aantalFout ?? 0);
  if (ta !== tb) return ta > tb ? a : b;
  const la = a.laatstGezien ?? "";
  const lb = b.laatstGezien ?? "";
  if (la !== lb) return la > lb ? a : b;
  return (a.box ?? 1) >= (b.box ?? 1) ? a : b;
}

/** Union van twee item-stores; per item de rijkste versie. Voorkomt dat een lege/oudere
 * cloud-staat lokale voortgang wegvaagt (én omgekeerd) — dé oorzaak van zoekgeraakte voortgang. */
function mergeItems(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [id, v] of Object.entries(b)) {
    out[id] = id in out ? beterItem(out[id] as ItemRec, v as ItemRec) : v;
  }
  return out;
}

type SchrijfRec = { score?: number; concept?: Record<string, string> };

/** Union van twee schrijf-stores; per opdracht de hoogste score en het langste concept
 * per stap — zodat een lokaal getypt concept nooit door een lege cloud-versie sneuvelt. */
function mergeSchrijf(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [id, vv] of Object.entries(b)) {
    const v = vv as SchrijfRec;
    const cur = out[id] as SchrijfRec | undefined;
    if (!cur) {
      out[id] = v;
      continue;
    }
    const score = Math.max(cur.score ?? Number.NEGATIVE_INFINITY, v.score ?? Number.NEGATIVE_INFINITY);
    const concept: Record<string, string> = {};
    const keys = new Set([...Object.keys(cur.concept ?? {}), ...Object.keys(v.concept ?? {})]);
    for (const k of keys) {
      const lc = cur.concept?.[k] ?? "";
      const cc = v.concept?.[k] ?? "";
      concept[k] = lc.length >= cc.length ? lc : cc;
    }
    const rec: SchrijfRec = {};
    if (Number.isFinite(score)) rec.score = score;
    if (keys.size) rec.concept = concept;
    out[id] = rec;
  }
  return out;
}

/** Schrijf cloud-data terug naar localStorage. Retourneert `true` als lokaal ná de merge
 * méér bevat dan de cloud (dan moet de samengevoegde unie teruggepusht worden om te genezen). */
function writeLocal(naam: string, data: ProgressDoc): boolean {
  const s = slug(naam);
  let lokaalRijker = false;
  // items + schrijf: UNION met lokaal (nooit blind overschrijven — anders wist een
  // lege/oudere cloud-staat de lokale voortgang).
  if (data.items) {
    const lokaal = parse(localStorage.getItem(localKey(s)), {} as Record<string, unknown>);
    const samen = mergeItems(lokaal, data.items);
    localStorage.setItem(localKey(s), JSON.stringify(samen));
    if (Object.keys(samen).length > Object.keys(data.items).length) lokaalRijker = true;
  }
  if (data.schrijf) {
    const lokaal = parse(localStorage.getItem(schrijfLocalKey(s)), {} as Record<string, unknown>);
    const samen = mergeSchrijf(lokaal, data.schrijf);
    localStorage.setItem(schrijfLocalKey(s), JSON.stringify(samen));
    if (Object.keys(samen).length > Object.keys(data.schrijf).length) lokaalRijker = true;
  }
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
  // afvink: OR-union — eenmaal afgevinkt blijft afgevinkt (een ouder-goedkeuring of
  // afgerond offline werk mag niet door een lege/oudere staat teruggedraaid worden).
  if (data.afvink) {
    const lokaal = parse(localStorage.getItem(afvinkLocalKey(s)), {} as Record<string, boolean>);
    const samen = { ...lokaal };
    for (const [k, v] of Object.entries(data.afvink)) if (v) samen[k] = true;
    localStorage.setItem(afvinkLocalKey(s), JSON.stringify(samen));
  }
  // dagschema: verleden = bevroren historie (dagdoel-bonus) → nooit aanraken. Vandaag +
  // toekomst = de cloud is leidend → altijd terugschrijven, zodat apparaten convergeren op
  // hetzelfde "vandaag"-schema (samen met de write-once in bewaarDagschema pusht geen enkel
  // apparaat nog een gekrompen variant terug, dus de eerst-bevroren lijst blijft canoniek).
  if (data.dagschema) {
    const vandaag = new Date().toISOString().slice(0, 10);
    for (const [datum, blokken] of Object.entries(data.dagschema)) {
      const k = `${schemaPrefix(s)}${datum}`;
      if (datum < vandaag) {
        if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(blokken));
      } else {
        localStorage.setItem(k, JSON.stringify(blokken));
      }
    }
  }
  return lokaalRijker;
}

/** Stabiele serialisatie van alle gesyncte velden (voor echo-detectie). */
function serialize(d: Partial<LocalState>): string {
  return [d.items ?? {}, d.schrijf ?? {}, d.resultaten ?? [], d.cat2 ?? {}, d.dagschema ?? {}, d.afvink ?? {}]
    .map((x) => JSON.stringify(x))
    .join("|");
}

/** Markeer dat de cloud-staat door de server is bevestigd; flush een eventueel
 * uitgestelde push. Vanaf nu is pushen veilig (we kunnen niet meer blind clobberen). */
function markHydrated(s: string): void {
  if (hydrated) return;
  hydrated = true;
  // Signaleer aan de UI dat de cloud-staat binnen is — componenten die het dagschema
  // voor vandaag bevriezen wachten hierop (anders bevriezen ze pre-hydratie staat).
  window.dispatchEvent(new CustomEvent("pww-hydrated", { detail: { naam: s } }));
  if (deferredPush) {
    deferredPush = false;
    doSchedule(s);
  }
}

function doSchedule(s: string): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    pushNow(s).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[firestoreSync] push failed:", err);
    });
  }, DEBOUNCE_MS);
}

/**
 * Pakt de huidige naam-doc en zet een live listener op. Cloud-state wordt bij elke
 * hit met lokaal samengevoegd (union — nooit blind overschrijven). Roep eenmaal aan
 * bij naam-claim (of bij app-boot als naam bekend is uit localStorage).
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
  hydrated = false;
  deferredPush = false;
  const ref = doc(db, "progress", s);
  // includeMetadataChanges: zo krijgen we óók de overgang cache→server-bevestigd,
  // wat de `hydrated`-vlag betrouwbaar zet (anti-clobber, zie boven).
  unsubscribe = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      const vanServer = !snap.metadata.fromCache;
      if (!snap.exists()) {
        // Server bevestigt: doc bestaat (nog) niet → pushen mag (doc aanmaken).
        if (vanServer) markHydrated(s);
        return;
      }
      const data = snap.data() as ProgressDoc;
      const serialized = serialize(data);
      if (serialized === lastIncomingSerialized) {
        if (vanServer) markHydrated(s); // eigen echo / ongewijzigd, maar wél hydratie
        return;
      }
      lastIncomingSerialized = serialized;
      const lokaalRijker = writeLocal(naam, data);
      // Notify React tree dat localStorage is bijgewerkt — App.tsx luistert.
      window.dispatchEvent(new CustomEvent("pww-progress-updated", { detail: { naam: s } }));
      if (vanServer) markHydrated(s);
      // Had lokaal méér dan de cloud? Push de samengevoegde unie terug — zo geneest
      // een eerder leeggelopen cloud-doc zodra een device met data weer online komt.
      if (lokaalRijker) schedulePush(naam);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn("[firestoreSync] onSnapshot error:", err);
    }
  );
}

/**
 * Is de cloud-staat minstens één keer door de server bevestigd? Componenten die het
 * dagschema voor vandaag bevriezen wachten hierop, zodat ze niet pre-hydratie (uit
 * lege/oude lokale staat) een verkeerd schema vastleggen. Zonder Firebase: altijd `true`
 * (localStorage-only, niets om op te wachten).
 */
export function isHydrated(): boolean {
  return !firebaseEnabled || hydrated;
}

export function stopSync(): void {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  pendingNaam = null;
  hydrated = false;
  deferredPush = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

/**
 * Debounced push: roep aan na elke lokale save. Verzamelt edits binnen
 * DEBOUNCE_MS en doet één setDoc-merge. Pusht NIET voordat de cloud is gehydrateerd
 * (anti-clobber) — de push wordt dan uitgesteld tot de eerste server-bevestiging.
 */
export function schedulePush(naam: string): void {
  if (!firebaseEnabled || !db) return;
  const s = slug(naam);
  if (!hydrated) {
    deferredPush = true; // wacht op cloud-hydratie vóór we (mogelijk leeg) pushen
    return;
  }
  doSchedule(s);
}

async function pushNow(s: string): Promise<void> {
  if (!db) return;
  const local = readLocal(s);
  // Onze eigen push komt straks terug via onSnapshot — markeren zodat we 'm niet
  // als "incoming" verwerken.
  lastIncomingSerialized = serialize(local);
  // Laatste vangnet tegen dataverlies: schrijf `items`/`schrijf` alléén mee als er
  // iets ín zit. Een (tijdelijk) lege lokale staat mag NOOIT een gevulde cloud-staat
  // wegvagen; merge:true behoudt dan het bestaande cloud-veld.
  const payload: Record<string, unknown> = {
    naam: s,
    resultaten: local.resultaten,
    cat2: local.cat2,
    dagschema: local.dagschema,
    afvink: local.afvink,
    updated: serverTimestamp(),
  };
  if (Object.keys(local.items).length > 0) payload.items = local.items;
  if (Object.keys(local.schrijf).length > 0) payload.schrijf = local.schrijf;
  await setDoc(doc(db, "progress", s), payload, { merge: true });
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
