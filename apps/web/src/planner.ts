import { BLOKKEN, type Blok, type BlokSoort } from "./content";
import { blokMastery, isGezien, laatsteScore } from "./progress";
import { planPeriode, type DagSlot, type DagType, type SchemaResultaat, type VakInput, type VakBlok } from "@pww/planner-engine";

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

// ── Meerdaagse kalender-planner (SPEC §7) ───────────────────────────────────────
// Adapter boven @pww/planner-engine: bouwt vak-inputs + rooster en levert het schema.

// Leerperiode + PWW uit manifest.yaml.
const LEERPERIODE_START = "2026-06-08";
const HERHAALWEEK_START = "2026-06-22"; // 22–26 juni: alleen herhaling
const PWW_START = "2026-06-29";
const PWW_EIND = "2026-07-03";

// Moeilijkheid per vak (manifest §5). Stuurt prioriteit/intensiteit.
const MOEILIJKHEID: Record<string, 1 | 2 | 3> = {
  wiskunde: 3,
  frans: 3,
  nederlands: 3,
  engels: 2,
  geschiedenis: 2,
  biologie: 1,
  aardrijkskunde: 1,
};
// Alleen makkelijke Cat-1-vakken mogen op een gereduceerde dag (wo/za, SPEC §7).
const GEREDUCEERD_OK = new Set(["biologie", "aardrijkskunde"]);

/** Grove tijdsschatting per trainer-blok (min). Heuristiek; later te finetunen. */
export function duurMin(blok: Blok): number {
  if (blok.soort === "schrijven") return 30;
  const n = blok.ids.length;
  const perItem = blok.soort === "uitlegvragen" ? 1.5 : 0.4;
  return Math.min(30, Math.max(6, Math.round(n * perItem)));
}

/** Pak trainer-blokken (in volgorde) in vak-blokken van ~30 min. */
function pakVakBlokken(vak: string, blokken: Blok[]): VakBlok[] {
  const out: VakBlok[] = [];
  let cur: string[] = [];
  let curMin = 0;
  let idx = 0;
  const sluit = () => {
    if (cur.length) {
      out.push({ id: `${vak}#${idx++}`, vak, trainerBlokIds: cur });
      cur = [];
      curMin = 0;
    }
  };
  for (const b of blokken) {
    const d = duurMin(b);
    if (cur.length && curMin + d > 33) sluit();
    cur.push(b.id);
    curMin += d;
    if (curMin >= 28) sluit();
  }
  sluit();
  return out;
}

function isoDag(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Rooster-slots 8/6 t/m 3/7 met dagtype (SPEC §7). */
export function roosterSlots(): DagSlot[] {
  const toetsPerDatum: Record<string, string[]> = {};
  for (const [vak, d] of Object.entries(PWW_DATUM)) (toetsPerDatum[d] ??= []).push(vak);
  const slots: DagSlot[] = [];
  const start = Date.parse(`${LEERPERIODE_START}T00:00:00Z`);
  const eind = Date.parse(`${PWW_EIND}T00:00:00Z`);
  for (let t = start; t <= eind; t += 86_400_000) {
    const datum = isoDag(t);
    const dow = new Date(t).getUTCDay(); // 0=zo … 3=wo … 6=za
    let type: DagType;
    if (datum >= PWW_START) type = "toets";
    else if (datum >= HERHAALWEEK_START) type = "buffer";
    else type = dow === 3 || dow === 6 ? "gereduceerd" : "leer";
    slots.push({ datum, type, toetsVakken: toetsPerDatum[datum] ?? [] });
  }
  return slots;
}

/** Bouw vak-inputs uit BLOKKEN + huidige voortgang en draai de engine. */
export function kalenderSchema(naam: string, vandaagISO: string): SchemaResultaat {
  const perVak = new Map<string, Blok[]>();
  for (const b of BLOKKEN) {
    if (!perVak.has(b.vak)) perVak.set(b.vak, []);
    perVak.get(b.vak)!.push(b);
  }
  const vakInputs: VakInput[] = Object.keys(PWW_DATUM).map((vak) => {
    const vakBlokken = (perVak.get(vak) ?? [])
      .slice()
      .sort((a, b) => a.hoofdstuk.localeCompare(b.hoofdstuk) || a.titel.localeCompare(b.titel));
    const nietAf = vakBlokken.filter((b) => blokStatus(naam, b).status !== "afgevinkt");
    return {
      vak,
      pwwDatum: PWW_DATUM[vak] ?? PWW_EIND,
      moeilijkheid: MOEILIJKHEID[vak] ?? 2,
      gereduceerdOk: GEREDUCEERD_OK.has(vak),
      isBoek: vakBlokken.length === 0,
      maxSessies: vak === "nederlands" ? 3 : undefined,
      pending: pakVakBlokken(vak, nietAf),
      alleBlokIds: vakBlokken.map((b) => b.id),
    };
  });
  return planPeriode(vakInputs, roosterSlots(), vandaagISO);
}
