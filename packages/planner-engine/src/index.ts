// Meerdaagse planner-engine (SPEC §7). Pure functie: geen DOM, geen localStorage,
// geen content-kennis. De web-adapter levert al-ingepakte vak-blokken (~30 min) +
// rooster-config aan; deze engine verdeelt ze over de dagen vanaf vandaag.
//
// Kernregels (Ralph):
//  - Alle content aangeraakt vóór de herhaalweek (dekking); herhaalweek = alleen review.
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
}

export interface SchemaResultaat {
  dagen: DagToewijzing[];
  /** Pacing-waarschuwingen (SPEC §7): bv. content past niet vóór de herhaalweek. */
  flags: string[];
}

const CAP: Record<DagType, number> = { leer: 3, gereduceerd: 1, buffer: 3, toets: 0, vrij: 0 };

/**
 * Verdeel de pending vak-blokken + boek-/review-blokken over de dagen vanaf `vandaag`.
 * Pure functie: dezelfde input → hetzelfde schema. Herplannen = opnieuw aanroepen met
 * de bijgewerkte `pending` (afgevinkte blokken zijn er dan uit → de rest schuift door).
 */
export function planPeriode(vakken: VakInput[], slots: DagSlot[], vandaag: string): SchemaResultaat {
  const flags: string[] = [];
  const dagen: DagToewijzing[] = slots
    .filter((s) => s.datum >= vandaag)
    .map((s) => ({ datum: s.datum, type: s.type, toetsVakken: s.toetsVakken, blokken: [] }));

  // Prioriteit: vroegste toets eerst, dan moeilijkste vak eerst.
  const prioriteit = [...vakken].sort(
    (a, b) => a.pwwDatum.localeCompare(b.pwwDatum) || b.moeilijkheid - a.moeilijkheid,
  );
  const queue = new Map(vakken.map((v) => [v.vak, [...v.pending]]));
  const sessies = new Map(vakken.map((v) => [v.vak, 0]));

  const vakkenOp = (d: DagToewijzing) => new Set(d.blokken.map((b) => b.vak));
  function mag(v: VakInput, d: DagToewijzing): boolean {
    if (d.blokken.length >= CAP[d.type]) return false;
    const op = vakkenOp(d);
    if (op.has(v.vak)) return false; // max 1 leerblok per vak per dag
    if (op.size >= 3) return false; // max 3 vakken per dag
    if (d.type === "gereduceerd" && !v.gereduceerdOk) return false;
    if (v.maxSessies != null && (sessies.get(v.vak) ?? 0) >= v.maxSessies) return false;
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
  }

  const leerDagen = dagen.filter((d) => d.type === "leer" || d.type === "gereduceerd");
  const bufferDagen = dagen.filter((d) => d.type === "buffer");

  // Vakken die elke niet-gereduceerde dag een gegarandeerd slot krijgen (Stijns
  // afspraak: wiskunde 5/7 dagen). Deze worden vóór alle andere logica geplaatst,
  // zodat ze nooit door content-vakken weggedrukt worden.
  const dagelijkseVakken = prioriteit.filter((v) => v.dagelijks);
  function plaatsDagelijks(d: DagToewijzing) {
    for (const v of dagelijkseVakken) {
      if (mag(v, d)) plaats(v, d, null, v.isBoek ? "boek" : "trainer");
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
    while (d.blokken.length < CAP[d.type]) {
      const v = prioriteit.find((v) => !v.isBoek && (queue.get(v.vak)!.length > 0) && mag(v, d));
      if (!v) break;
      plaats(v, d, queue.get(v.vak)!.shift()!, "trainer");
    }
    // 3) Nog ruimte over (content op) → extra boek.
    while (d.blokken.length < CAP[d.type]) {
      const boek = kiesBoek(d);
      if (!boek) break;
      plaats(boek, d, null, "boek");
    }
  }

  // Content die niet vóór de herhaalweek paste → waarschuwing (SPEC §7 pacing).
  for (const v of vakken) {
    const over = queue.get(v.vak)!.length;
    if (!v.isBoek && over > 0) {
      flags.push(`${v.vak}: ${over} leerblok(ken) passen niet meer vóór de herhaalweek — meer tijd of minder scope nodig.`);
    }
  }

  // Herhaalweek: alleen review (geen nieuwe stof). Eventuele leftover content mag hier
  // nog landen (vangnet); daarna review, gebalanceerd over álle vakken (minst-herhaald
  // eerst), met content-vakken vóór boek-vakken op gelijke stand.
  for (const d of bufferDagen) {
    // Dagelijkse vakken (wiskunde) krijgen ook hier elke buffer-dag een slot
    // (geen gereduceerde dagen in de herhaalweek). Wordt geboekt als "boek" zodat
    // Stijn doorgaat in zijn boek; review van content-vakken vult de rest.
    plaatsDagelijks(d);
    while (d.blokken.length < CAP[d.type]) {
      const leftover = prioriteit.find((v) => !v.isBoek && (queue.get(v.vak)!.length > 0) && mag(v, d));
      if (leftover) {
        plaats(leftover, d, queue.get(leftover.vak)!.shift()!, "trainer");
        continue;
      }
      const kandidaten = prioriteit
        .filter((v) => mag(v, d))
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

  return { dagen, flags };
}
