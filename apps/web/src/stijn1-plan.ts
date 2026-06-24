// Stijns eigen, met-de-hand-gemaakte leerplanning (vastgelegd 2026-06-24, in overleg
// met Ralph). Voor gebruiker `stijn1` vervangt dit volledig de AI-planner: hij ziet
// exact zijn eigen schema en verdient daar de dagdoel-punten mee. Dit is bewust een
// VAST (deterministisch) schema — het herschikt niet als de voortgang verandert.
//
// Bijzonderheden (afspraken Ralph):
//  - Wiskunde = elke dag zelf-gekozen boekoefeningen → een afvink-blok dat alléén een
//    ouder goedkeurt (Stijn kan niet zelf punten pakken).
//  - Optionele blokken (geschiedenis op za, aardrijkskunde op zo) staan achteraan en
//    tellen niet mee voor de dagdoel-bonus/streak.
//  - Geschiedenis is in twee even zware delen gesplitst (hoofdstuk-split, vaardigheden
//    verdeeld): deel 1 (do) = H5 + chronologie/soorten; deel 2 (vr) = H6 + tijdvakken +
//    tijdbalk. Onafgeronde stof blijft op za zichtbaar; do 2/7 = herhaling van álles.
//  - Vandaag (24/6): al-begonnen werk blijft staan, de rest → Franse werkwoorden
//    (de today-merge gebeurt in planner.ts; hier staat alleen het frans-werkwoorden-blok).
import type { Blok } from "./content";
import type { DagToewijzing, GeplandBlok, SchemaResultaat } from "@pww/planner-engine";

export const STIJN1 = "stijn1";

// ── Blok → GeplandBlok-fabrieken ────────────────────────────────────────────────
// Eén blokje PER VAK per dag (afspraak Ralph 2026-06-24): bundel alle trainer-blokken
// van hetzelfde vak tot één GeplandBlok, zodat de kalender één chip per vak toont i.p.v.
// een chip per losse trainer. De individuele trainers blijven als kaarten zichtbaar in
// het dagdetail (en de Kalender verbergt deze week de al-beheerste trainers).
function bundel(blokken: Blok[], optioneel = false): GeplandBlok | null {
  if (blokken.length === 0) return null;
  const vak = blokken[0]!.vak;
  return {
    vak,
    vakBlokId: `${vak}/dag`,
    trainerBlokIds: blokken.map((b) => b.id),
    soort: "trainer",
    ...(optioneel ? { optioneel: true } : {}),
  };
}
function afvink(vak: string, id: string, label: string, opts: { ouder?: boolean; optioneel?: boolean } = {}): GeplandBlok {
  return {
    vak,
    vakBlokId: id,
    trainerBlokIds: [],
    soort: "afvink",
    afvink: { id, label, ...(opts.ouder ? { ouderGoedkeuring: true } : {}) },
    ...(opts.optioneel ? { optioneel: true } : {}),
  };
}

// Wiskunde-afvink van de dag (zelf-gekozen boekoefeningen; ouder keurt goed).
function wiskundeBoek(datum: string): GeplandBlok {
  return afvink("wiskunde", `wiskunde-boek:${datum}`, "Wiskunde — zelf-gekozen boekoefeningen", { ouder: true });
}

// Voegt trainer-blokken van hetzelfde vak samen tot één bundel (één chip per vak),
// met behoud van volgorde + optioneel-vlag van de eerste. Afvink-blokken blijven los.
// Borgt o.a. dat vandaag de al-begonnen frans-stof + de frans-werkwoorden één chip worden.
function mergePerVak(blokken: GeplandBlok[]): GeplandBlok[] {
  const out: GeplandBlok[] = [];
  const idx = new Map<string, number>();
  for (const b of blokken) {
    if (b.soort !== "trainer") {
      out.push(b);
      continue;
    }
    const pos = idx.get(b.vak);
    if (pos === undefined) {
      idx.set(b.vak, out.length);
      out.push({ ...b, trainerBlokIds: [...b.trainerBlokIds] });
    } else {
      const ex = out[pos]!;
      out[pos] = { ...ex, trainerBlokIds: [...new Set([...ex.trainerBlokIds, ...b.trainerBlokIds])] };
    }
  }
  return out;
}

/**
 * Bouwt Stijns vaste schema. `begonnenVandaag` = de blokken van vandaag die hij al
 * (deels) begonnen is (door planner.ts aangeleverd uit het bevroren schema); die
 * blijven vóór de Franse werkwoorden staan.
 */
export function bouwStijn1Schema(blokken: Blok[], vandaagISO: string, begonnenVandaag: GeplandBlok[] = []): SchemaResultaat {
  const byId = new Map(blokken.map((b) => [b.id, b]));
  const pick = (...ids: string[]): Blok[] => ids.map((id) => byId.get(id)).filter((b): b is Blok => !!b);
  const vak = (v: string): Blok[] => blokken.filter((b) => b.vak === v).slice().sort((a, b) => a.id.localeCompare(b.id));
  const fransVocab = (): Blok[] => blokken.filter((b) => b.id.startsWith("frans/woordjes/")).sort((a, b) => a.id.localeCompare(b.id));
  const fransAlles = (): Blok[] => [
    ...pick("frans/werkwoorden/h6"),
    ...fransVocab(),
    ...pick("frans/vertalen/h6", "frans/invullen/h6"),
  ];

  // Geschiedenis-blokken op `onderdeel` selecteren (robuust: content.ts kan kleine
  // paragrafen samenvoegen — bv. §5.3+§5.4 — en de oefenvragen tot één blok bundelen).
  const gesch = blokken.filter((b) => b.vak === "geschiedenis");
  const gMatch = (re: RegExp) => gesch.filter((b) => re.test(b.onderdeel));
  const geschH5 = gMatch(/^§5\./); // §5.1, §5.2, §5.3+§5.4
  const geschH6 = gMatch(/^§6\./); // §6.1
  const geschChronoSoorten = gMatch(/chronologie, tijdbalk & soorten/i);
  const geschTijdvakken = gMatch(/tijdvakken/i);
  const geschTijdbalk = gMatch(/^chronologie \(tijdbalk\)/i);
  const geschOefen = gesch.filter((b) => b.soort === "uitlegvragen");
  const geschAlles = gesch.slice().sort((a, b) => a.id.localeCompare(b.id));

  // Deel 1 (do): H5 (§5.1–5.4 = 26) + chronologie/soorten (10) + de oefenvragen.
  const geschDeel1 = [...geschH5, ...geschChronoSoorten, ...geschOefen];
  // Deel 2 (vr): H6 (§6.1 = 10) + tijdvakken (17) + tijdbalk (8) → ≈ even zwaar.
  const geschDeel2 = [...geschH6, ...geschTijdvakken, ...geschTijdbalk];
  // wo 1/7: de lastige chronologie-stof herhalen.
  const geschChronologie = [...geschTijdbalk, ...geschChronoSoorten, ...geschTijdvakken];

  // [datum ISO] → blokken (één per vak; niet-optioneel eerst, optioneel achteraan).
  // `null`-bundels (leeg vak) en lege dagen vallen er straks uit.
  const dagen: Record<string, (GeplandBlok | null)[]> = {
    // wo 24/6 — vandaag: begonnen werk blijft + Franse werkwoorden voor de rest.
    "2026-06-24": [...begonnenVandaag, bundel(pick("frans/werkwoorden/h6"))],
    // do 25/6 — Frans (vocab) · Geschiedenis deel 1 · Wiskunde.
    "2026-06-25": [bundel(fransVocab()), bundel(geschDeel1), wiskundeBoek("2026-06-25")],
    // vr 26/6 — Geschiedenis deel 2 · Frans (vertaalzinnen) · Wiskunde.
    "2026-06-26": [bundel(geschDeel2), bundel(pick("frans/vertalen/h6")), wiskundeBoek("2026-06-26")],
    // za 27/6 — Frans (cloze) · Biologie · Wiskunde · Geschiedenis (optioneel, achteraan).
    "2026-06-27": [bundel(pick("frans/invullen/h6")), bundel(vak("biologie")), wiskundeBoek("2026-06-27"), bundel(geschAlles, true)],
    // zo 28/6 — Engels · Wiskunde · Handvaardigheid (zelf afvinken) · Aardrijkskunde (optioneel).
    "2026-06-28": [
      bundel(vak("engels")),
      wiskundeBoek("2026-06-28"),
      afvink("handvaardigheid", "handvaardigheid:2026-06-28", "Handvaardigheid & tekenen (zelfstudie)"),
      bundel(vak("aardrijkskunde"), true),
    ],
    // ma 29/6 (engels-toets) — Biologie · Wiskunde.
    "2026-06-29": [bundel(vak("biologie")), wiskundeBoek("2026-06-29")],
    // di 30/6 (bio-toets) — Nederlands · Wiskunde · Frans (herhaling).
    "2026-06-30": [bundel(vak("nederlands")), wiskundeBoek("2026-06-30"), bundel(fransAlles())],
    // wo 1/7 (ndl-toets) — Aardrijkskunde · Wiskunde · Geschiedenis (chronologie-herhaling).
    "2026-07-01": [bundel(vak("aardrijkskunde")), wiskundeBoek("2026-07-01"), bundel(geschChronologie)],
    // do 2/7 (wisk.+ak-toets) — Frans (alles) · Geschiedenis (herhaling: alle onderdelen).
    "2026-07-02": [bundel(fransAlles()), bundel(geschAlles)],
  };

  const toewijzingen: DagToewijzing[] = Object.entries(dagen)
    .map(([datum, bl]) => ({ datum, blokken: mergePerVak(bl.filter((b): b is GeplandBlok => !!b)) }))
    .filter(({ blokken }) => blokken.length > 0)
    .map(({ datum, blokken }) => ({ datum, type: "leer" as const, toetsVakken: [], blokken, cap: blokken.length }));

  return { dagen: toewijzingen, flags: [] };
}
