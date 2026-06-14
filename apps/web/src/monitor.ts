// Monitor-view (Ralph): leest ALLE leerling-voortgang uit Firestore en leidt per
// leerling dezelfde afgeleide cijfers af die de leerling zelf ziet — punten,
// voortgang, schema-naleving en bestede tijd.
//
// Truc om geen rekenlogica te dupliceren: elk opgehaald doc wordt eerst in
// localStorage gehydrateerd onder zijn eigen slug. De bestaande gamification/
// planner-functies zijn al per-slug gesleuteld, dus we roepen ze daarna gewoon
// aan met de slug als "naam". (slug() is idempotent → slug(slug) === slug.)
//
// Toegang: "geheime naam" (geen auth; Firestore-reads zijn toch al open per
// firestore.rules). Wie inlogt met MONITOR_SLUG krijgt het dashboard i.p.v. de
// leerling-app. De monitor schrijft nooit leerling-data terug: schedulePush wordt
// alleen via logResultaat getriggerd, en dat doet de monitor niet.

import { collection, getDocs } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { BLOKKEN } from "./content";
import { blokStatus } from "./planner";
import { slug, laadDagschema, dagschemaDatums } from "./progress";
import {
  mijlpaalStand,
  streakDagen,
  tijdTotaalMin,
  tijdPerVakMin,
  tijdPerDagMin,
} from "./gamification";

/** Geheime naam waarmee Ralph het monitor-dashboard opent i.p.v. de leerling-app. */
export const MONITOR_SLUG = "ralph-monitor";

export function isMonitor(naam: string): boolean {
  return slug(naam) === MONITOR_SLUG;
}

export interface VakVoortgang {
  klaar: number;
  totaal: number;
  procent: number;
}

export interface StudentSamenvatting {
  slug: string;
  punten: number;
  mijlpaal: string | null;
  streak: number;
  tijdTotaalMin: number;
  tijdPerVakMin: Record<string, number>;
  tijdPerDagMin: Record<string, number>;
  voortgangPerVak: Record<string, VakVoortgang>;
  klaarTotaal: number;
  blokkenTotaal: number;
  /** Aantal dagen met een (bevroren) dagschema dat trainer-blokken bevatte. */
  schemaGepland: number;
  /** Daarvan: dagen waarop álle geplande trainer-blokken zijn afgevinkt (dagdoel). */
  schemaBehaald: number;
  /** Laatste ISO-datum met gelogde studietijd, of null. */
  laatstActief: string | null;
}

const blokById = new Map(BLOKKEN.map((b) => [b.id, b]));

interface ProgressDoc {
  naam?: string;
  items?: Record<string, unknown>;
  schrijf?: Record<string, unknown>;
  resultaten?: unknown[];
  cat2?: Record<string, string>;
  dagschema?: Record<string, unknown>;
}

/** Schrijf één leerling-doc naar localStorage onder zijn slug (overschrijven). */
function hydrateLokaal(s: string, doc: ProgressDoc): void {
  localStorage.setItem(`pww-progress:${s}`, JSON.stringify(doc.items ?? {}));
  localStorage.setItem(`pww-schrijf:${s}`, JSON.stringify(doc.schrijf ?? {}));
  localStorage.setItem(`pww-resultaten:${s}`, JSON.stringify(doc.resultaten ?? []));
  localStorage.setItem(`pww-cat2:${s}`, JSON.stringify(doc.cat2 ?? {}));
  for (const [datum, blokken] of Object.entries(doc.dagschema ?? {})) {
    localStorage.setItem(`pww-schema:${s}:${datum}`, JSON.stringify(blokken));
  }
}

/** Leid de samenvatting af uit de (gehydrateerde) localStorage van één slug. */
function samenvatting(s: string): StudentSamenvatting {
  const voortgangPerVak: Record<string, VakVoortgang> = {};
  let klaarTotaal = 0;
  for (const b of BLOKKEN) {
    const v = (voortgangPerVak[b.vak] ??= { klaar: 0, totaal: 0, procent: 0 });
    v.totaal++;
    if (blokStatus(s, b).status === "afgevinkt") {
      v.klaar++;
      klaarTotaal++;
    }
  }
  for (const v of Object.values(voortgangPerVak)) {
    v.procent = v.totaal ? Math.round((v.klaar / v.totaal) * 100) : 0;
  }

  // Schema-naleving: zelfde dagdoel-regel als totaalPunten (gamification.ts).
  let schemaGepland = 0;
  let schemaBehaald = 0;
  for (const d of dagschemaDatums(s)) {
    const ids = (laadDagschema(s, d) ?? []).flatMap((b) => b.trainerBlokIds);
    if (!ids.length) continue;
    schemaGepland++;
    const allesAf = ids.every((id) => {
      const blk = blokById.get(id);
      return blk && blokStatus(s, blk).status === "afgevinkt";
    });
    if (allesAf) schemaBehaald++;
  }

  const tijdPerDag = tijdPerDagMin(s);
  const datums = Object.keys(tijdPerDag).sort();
  const stand = mijlpaalStand(s);
  return {
    slug: s,
    punten: stand.punten,
    mijlpaal: stand.huidige?.naam ?? null,
    streak: streakDagen(s),
    tijdTotaalMin: tijdTotaalMin(s),
    tijdPerVakMin: tijdPerVakMin(s),
    tijdPerDagMin: tijdPerDag,
    voortgangPerVak,
    klaarTotaal,
    blokkenTotaal: BLOKKEN.length,
    schemaGepland,
    schemaBehaald,
    laatstActief: datums.length ? datums[datums.length - 1]! : null,
  };
}

/**
 * Haal alle leerling-samenvattingen op (gesorteerd op punten, hoog→laag). Zonder
 * Firebase valt het terug op wat lokaal in localStorage staat (dev-mode).
 */
export async function laadAlleStudenten(): Promise<StudentSamenvatting[]> {
  if (!firebaseEnabled || !db) return lokaleStudenten();
  const snap = await getDocs(collection(db, "progress"));
  const out: StudentSamenvatting[] = [];
  snap.forEach((d) => {
    hydrateLokaal(d.id, d.data() as ProgressDoc);
    out.push(samenvatting(d.id));
  });
  return out
    .filter((s) => s.slug !== MONITOR_SLUG)
    .sort((a, b) => b.punten - a.punten);
}

/** Fallback zonder Firebase: leid leerlingen af uit aanwezige localStorage-keys. */
function lokaleStudenten(): StudentSamenvatting[] {
  const slugs = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const m = localStorage.key(i)?.match(/^pww-resultaten:(.+)$/);
    if (m) slugs.add(m[1]!);
  }
  return [...slugs]
    .filter((s) => s !== MONITOR_SLUG)
    .map(samenvatting)
    .sort((a, b) => b.punten - a.punten);
}
