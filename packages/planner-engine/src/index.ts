// Meerdaagse planner-engine (SPEC §7). Pure functie: geen DOM, geen localStorage,
// geen content-kennis. De web-adapter levert al-ingepakte vak-blokken (~30 min) +
// rooster-config aan; deze engine verdeelt ze over de dagen vanaf vandaag.
//
// Kernregels (Ralph):
//  - Alle content liefst aangeraakt vóór de herhaalweek (dekking); herhaalweek = primair
//    review. Past het niet, dan mag leren uitlopen tot uiterlijk 3 dagen vóór de toets
//    van het vak — de laatste 3 dagen zijn altijd herhalen/automatiseren (2026-06-12).
//  - Max 3 vakken/dag; max 1 leerblok per vak per dag (elk blok ~30 min).
//  - Gereduceerde dagen (wo/za): 1 blok, alleen "makkelijke" Cat-1-vakken (Bio/AK).
//  - Boek-vakken (wiskunde/engels, nog geen trainer-content) krijgen gereserveerde
//    boek-leerblokken; wiskunde valt vanzelf op ~5/7 dagen (uitgesloten op wo/za).
//  - Nederlands max `maxSessies`. Content per vak in de aangeleverde volgorde.

export type DagType = "leer" | "gereduceerd" | "buffer" | "toets" | "vrij";
export type GeplandeSoort = "trainer" | "boek" | "review";

/** Eén ingepakt vak-blok (~30 min) met de trainer-blok-ids erin. */
export interface VakBlok {
  id: string;
  vak: string;
  trainerBlokIds: string[];
}

export interface VakInput {
  vak: string;
  /** ISO-datum van de PWW-toets (urgentie). */
  pwwDatum: string;
  moeilijkheid: 1 | 2 | 3;
  /** Mag dit vak op een gereduceerde dag (wo/za)? Alleen makkelijke Cat-1-vakken. */
  gereduceerdOk: boolean;
  /** Vak zonder digitale content → boek-leerblokken (wiskunde/engels). */
  isBoek: boolean;
  /** Harde bovengrens aan het aantal leerblokken (bv. Nederlands = 3). */
  maxSessies?: number;
  /**
   * Reserveer elke niet-gereduceerde dag (incl. buffer-week) als eerste een slot
   * voor dit vak. Voor wiskunde: ~5/7 dagen (ma/di/do/vr/zo + ma–vr in de
   * herhaalweek), zoals afgesproken met Stijn. Andere boek-vakken (engels)
   * blijven via de roterende kiesBoek-logica concurreren.
   */
  dagelijks?: boolean;
  /** Niet inplannen vóór deze ISO-datum (bv. wiskunde eenmalig uitstellen tot morgen). */
  nietVoor?: string;
  /** Minimaal aantal dagen tussen twee leerblokken van dit vak (spreiding, bv. nederlands). */
  minIntervalDagen?: number;
  /** Nog niet-afgeronde vak-blokken, in leervolgorde (leeg voor boek-vakken). */
  pending: VakBlok[];
  /** Alle trainer-blok-ids van het vak (voor review-blokken in de herhaalweek). */
  alleBlokIds: string[];
}

export interface DagSlot {
  datum: string; // ISO YYYY-MM-DD
  type: DagType;
  /** Vakken met een toets op deze dag. */
  toetsVakken: string[];
  /**
   * Capaciteits-override voor déze dag (aantal blokken), bovenop het dagtype.
   * Bv. verjaardagsfeest 13/6: leer-dag maar maar ~1 uur → cap 2.
   */
  cap?: number;
}

export interface GeplandBlok {
  vak: string;
  vakBlokId: string;
  trainerBlokIds: string[];
  soort: GeplandeSoort;
}

export interface DagToewijzing {
  datum: string;
  type: DagType;
  toetsVakken: string[];
  blokken: GeplandBlok[];
  /** Effectieve capaciteit van deze dag (slot-override of dagtype-default). */
  cap: number;
}

export interface SchemaResultaat {
  dagen: DagToewijzing[];
  /** Pacing-waarschuwingen (SPEC §7): bv. content past niet vóór de herhaalweek. */
  flags: string[];
}

export interface PlanOpties {
  /**
   * Niets inplannen vóór deze ISO-datum (naast `vandaag`). Voor het geval het leren
   * later begint dan de roosterperiode (bv. Stijn start pas op vrijdag).
   */
  startDatum?: string;
  /**
   * Aantal blokken (~30 min elk) op een volle leer-/buffer-dag. Default 3 (~1,5 u);
   * de web-adapter schaalt op naar 4 (~2 u) als de stof anders niet vóór de
   * herhaalweek past. Gereduceerde dagen blijven altijd 1 blok.
   */
  dagCap?: number;
  /** Max. aantal verschillende vakken per dag. Default = max(3, dagCap). */
  maxVakkenPerDag?: number;
}

const STANDAARD_CAP: Record<DagType, number> = { leer: 3, gereduceerd: 1, buffer: 3, toets: 0, vrij: 0 };

/**
 * Verdeel de pending vak-blokken + boek-/review-blokken over de dagen vanaf `vandaag`.
 * Pure functie: dezelfde input → hetzelfde schema. Herplannen = opnieuw aanroepen met
 * de bijgewerkte `pending` (afgevinkte blokken zijn er dan uit → de rest schuift door).
 */
export function planPeriode(
  vakken: VakInput[],
  slots: DagSlot[],
  vandaag: string,
  opties: PlanOpties = {},
): SchemaResultaat {
  const dagCap = opties.dagCap ?? STANDAARD_CAP.leer;
  const maxVakken = opties.maxVakkenPerDag ?? Math.max(3, dagCap);
  const startDatum = opties.startDatum;
  // Volle dagen (leer/buffer) krijgen de instelbare cap; gereduceerd/toets/vrij vast.
  // Een slot-cap (bv. verjaardagsfeest → 2 blokken) overrulet beide.
  const CAP: Record<DagType, number> = { ...STANDAARD_CAP, leer: dagCap, buffer: dagCap };

  const flags: string[] = [];
  const dagen: DagToewijzing[] = slots
    .filter((s) => s.datum >= vandaag && (!startDatum || s.datum >= startDatum))
    .map((s) => ({ datum: s.datum, type: s.type, toetsVakken: s.toetsVakken, blokken: [], cap: s.cap ?? CAP[s.type] }));

  // Prioriteit: vroegste toets eerst, dan moeilijkste vak eerst.
  const prioriteit = [...vakken].sort(
    (a, b) => a.pwwDatum.localeCompare(b.pwwDatum) || b.moeilijkheid - a.moeilijkheid,
  );
  const queue = new Map(vakken.map((v) => [v.vak, [...v.pending]]));
  const sessies = new Map(vakken.map((v) => [v.vak, 0])); // álle plaatsingen (balancering)
  // Alleen nieuwe-stof-plaatsingen (trainer/boek). maxSessies + spreiding kijken
  // hiernaar: een lichte review mag de leer-budget/-spreiding niet opeten.
  const leerSessies = new Map(vakken.map((v) => [v.vak, 0]));
  const laatst = new Map<string, string>(); // vak → laatste leerblok-datum (voor spreiding)
  const dagDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  const isoMinDagen = (iso: string, n: number) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

  const vakkenOp = (d: DagToewijzing) => new Set(d.blokken.map((b) => b.vak));
  // Basisregels die voor élke plaatsing gelden (capaciteit, max vakken/dag, 1/vak/dag, cap).
  function basisOk(v: VakInput, d: DagToewijzing): boolean {
    if (d.blokken.length >= d.cap) return false;
    const op = vakkenOp(d);
    if (op.has(v.vak)) return false; // max 1 leerblok per vak per dag
    if (op.size >= maxVakken) return false; // max. aantal vakken per dag
    if (v.maxSessies != null && (leerSessies.get(v.vak) ?? 0) >= v.maxSessies) return false;
    return true;
  }
  // Nieuwe leerstof (trainer/boek) mag tot uiterlijk 3 dagen vóór de toets van het
  // vak: de laatste 3 dagen zijn voor herhalen/automatiseren (afspraak 2026-06-12).
  const magLeren = (v: VakInput, datum: string) => datum < isoMinDagen(v.pwwDatum, 3);
  function mag(v: VakInput, d: DagToewijzing): boolean {
    if (!basisOk(v, d)) return false;
    if (d.type === "gereduceerd" && !v.gereduceerdOk) return false;
    if (v.nietVoor && d.datum < v.nietVoor) return false; // uitgesteld
    if (!magLeren(v, d.datum)) return false; // laatste 3 dagen = review-only
    const vorige = laatst.get(v.vak);
    if (v.minIntervalDagen && vorige && dagDiff(vorige, d.datum) < v.minIntervalDagen) return false;
    return true;
  }
  function plaats(v: VakInput, d: DagToewijzing, blok: VakBlok | null, soort: GeplandeSoort) {
    d.blokken.push({
      vak: v.vak,
      vakBlokId: blok?.id ?? `${v.vak}-${soort}-${d.datum}`,
      trainerBlokIds: blok?.trainerBlokIds ?? (soort === "review" ? v.alleBlokIds : []),
      soort,
    });
    sessies.set(v.vak, (sessies.get(v.vak) ?? 0) + 1);
    // Reviews tellen niet mee voor de leer-budget (maxSessies) of de spreiding:
    // anders blokkeert een rustdag-review een nog niet-geplaatst echt leerblok.
    if (soort !== "review") {
      leerSessies.set(v.vak, (leerSessies.get(v.vak) ?? 0) + 1);
      laatst.set(v.vak, d.datum);
    }
  }
  // Review-plaatsing (herhaalweek + gereduceerde dagen): negeert gereduceerdOk en
  // de spreidings-/uitstel-regels — het is lichte herhaling, geen nieuwe stof.
  function magReview(v: VakInput, d: DagToewijzing): boolean {
    return basisOk(v, d) && !(v.nietVoor && d.datum < v.nietVoor);
  }
  const kiesReview = (d: DagToewijzing): VakInput | undefined =>
    prioriteit
      .filter((v) => !v.isBoek && magReview(v, d))
      .sort((a, b) => (sessies.get(a.vak) ?? 0) - (sessies.get(b.vak) ?? 0))[0];

  const leerDagen = dagen.filter((d) => d.type === "leer" || d.type === "gereduceerd");
  const bufferDagen = dagen.filter((d) => d.type === "buffer");

  // Vakken die elke niet-gereduceerde dag een gegarandeerd slot krijgen (Stijns
  // afspraak: wiskunde 5/7 dagen). Deze worden vóór alle andere logica geplaatst,
  // zodat ze nooit door content-vakken weggedrukt worden.
  const dagelijkseVakken = prioriteit.filter((v) => v.dagelijks);
  function plaatsDagelijks(d: DagToewijzing) {
    for (const v of dagelijkseVakken) {
      if (mag(v, d)) {
        if (v.isBoek) {
          plaats(v, d, null, "boek");
          continue;
        }
        // Vak mét trainer-content (bv. wiskunde): trek een écht blok uit de wachtrij,
        // zodat de dagelijkse slot klikbare opgaven bevat. Is de stof op, dan een
        // review-blok — wiskunde blijft zo elke dag terugkomen zonder lege kaart.
        const q = queue.get(v.vak)!;
        const blok = q.shift() ?? null;
        plaats(v, d, blok, blok ? "trainer" : "review");
      } else if (!magLeren(v, d.datum) && d.type !== "gereduceerd" && magReview(v, d)) {
        // Laatste 3 dagen vóór de toets: het dagelijkse slot blijft bestaan,
        // maar wordt herhalen/automatiseren in plaats van nieuwe stof.
        plaats(v, d, null, "review");
      }
    }
  }

  // De minst-gebruikte boek-kandidaat (balanceert engels ↔ overige boek-vakken),
  // tiebreak op prioriteit. Vakken met `dagelijks: true` zijn op deze dag al
  // geplaatst en worden door `mag()` (same-vak-check) automatisch overgeslagen.
  const kiesBoek = (d: DagToewijzing): VakInput | undefined =>
    prioriteit
      .filter((v) => v.isBoek && mag(v, d))
      .sort((a, b) => (sessies.get(a.vak) ?? 0) - (sessies.get(b.vak) ?? 0))[0];

  for (const d of leerDagen) {
    // 0) Dagelijkse vakken (wiskunde) eerst — gegarandeerd slot op leer/zondag,
    //    overgeslagen op gereduceerde dagen via `mag`.
    plaatsDagelijks(d);
    // 1) Op een gewone leerdag ook een roterend boek-slot voor de overige boek-
    //    vakken (engels). Op gereduceerde dagen geen boek.
    if (d.type === "leer") {
      const boek = kiesBoek(d);
      if (boek) plaats(boek, d, null, "boek");
    }
    // 2) Vul met content in volgorde (hoogste prioriteit eerst), max 1/vak/dag.
    while (d.blokken.length < d.cap) {
      const v = prioriteit.find((v) => !v.isBoek && (queue.get(v.vak)!.length > 0) && mag(v, d));
      if (!v) break;
      plaats(v, d, queue.get(v.vak)!.shift()!, "trainer");
    }
    // 3) Nog ruimte over (content op) → extra boek.
    while (d.blokken.length < d.cap) {
      const boek = kiesBoek(d);
      if (!boek) break;
      plaats(boek, d, null, "boek");
    }
    // 4) Gereduceerde dag (wo/za) nog leeg? Rustdag ≠ niks → licht review-blok
    //    (van een content-vak, minst-herhaald eerst; bv. geschiedenis).
    if (d.type === "gereduceerd" && d.blokken.length === 0) {
      const rev = kiesReview(d);
      if (rev) plaats(rev, d, null, "review");
    }
  }

  // Herhaalweek: primair review. Eventuele leftover content mag hier nog landen
  // (vangnet, t/m 3 dagen vóór de toets van het vak — afspraak 2026-06-12); daarna
  // review, gebalanceerd over álle vakken (minst-herhaald eerst), met content-vakken
  // vóór boek-vakken op gelijke stand.
  for (const d of bufferDagen) {
    // Dagelijkse vakken (wiskunde) krijgen ook hier elke buffer-dag een slot
    // (geen gereduceerde dagen in de herhaalweek). Wordt geboekt als "boek" zodat
    // Stijn doorgaat in zijn boek; review van content-vakken vult de rest.
    plaatsDagelijks(d);
    while (d.blokken.length < d.cap) {
      const leftover = prioriteit.find((v) => !v.isBoek && (queue.get(v.vak)!.length > 0) && mag(v, d));
      if (leftover) {
        plaats(leftover, d, queue.get(leftover.vak)!.shift()!, "trainer");
        continue;
      }
      const kandidaten = prioriteit
        .filter((v) => magReview(v, d))
        .sort(
          (a, b) =>
            (sessies.get(a.vak) ?? 0) - (sessies.get(b.vak) ?? 0) ||
            (a.isBoek ? 1 : 0) - (b.isBoek ? 1 : 0),
        );
      const v = kandidaten[0];
      if (!v) break;
      plaats(v, d, null, v.isBoek ? "boek" : "review");
    }
  }

  // Content die zelfs met uitloop (leren t/m 3 dagen vóór de toets) nergens meer
  // past → harde waarschuwing (SPEC §7 pacing).
  for (const v of vakken) {
    const over = queue.get(v.vak)!.length;
    if (!v.isBoek && over > 0) {
      flags.push(
        `${v.vak}: ${over} leerblok(ken) passen nergens meer (zelfs niet t/m 3 dagen vóór de toets) — minder scope of meer uren nodig.`,
      );
    }
  }

  return { dagen, flags };
}
