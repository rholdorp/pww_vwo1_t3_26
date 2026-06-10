/**
 * Cat-2 adaptieve oefen-engine (SPEC §5 — Wiskunde). Pure state-machine: geen DOM,
 * geen content-kennis, geen randomness binnen de engine (de caller levert de pool
 * per onderdeel al in de gewenste — eventueel geschudde — volgorde aan; de engine
 * trekt er deterministisch uit, zodat het testbaar is).
 *
 * Per onderdeel (= paragraaf) pakt de engine 2 opgaven:
 *   2/2 → ✓ onderdeel klaar, door naar het volgende
 *   1/2 → +2 extra; bij ≥3/4 → ✓, anders +2 (tot ≥50% van de gevraagde set)
 *   0/2 → +2 extra (fout toont het juiste antwoord + een vergelijkbare som); tot ≥50%
 * Synthese-onderdelen worden pas vrijgespeeld als álle losse onderdelen ✓ zijn.
 */

/** Minimale opgave-info die de engine nodig heeft (volledige data zit in de content). */
export interface Cat2Opgave {
  id: string;
  onderdeel: string;
  onderdeelTitel: string;
  isSynthese: boolean;
}

export type OnderdeelStatusKind = "open" | "klaar" | "deels" | "vergrendeld";

export interface OnderdeelVoortgang {
  onderdeel: string;
  titel: string;
  isSynthese: boolean;
  /** Aantal gestelde opgaven. */
  gevraagd: number;
  /** Aantal goed. */
  goed: number;
  /** Hoeveel opgaven nu zijn toegezegd (groeit met +2 bij onvoldoende). */
  target: number;
  /** Aantal opgaven in de pool van dit onderdeel. */
  poolGrootte: number;
  status: OnderdeelStatusKind;
}

export interface Cat2State {
  /** Pool van opgave-ids per onderdeel, in trekvolgorde. */
  pools: Record<string, string[]>;
  voortgang: OnderdeelVoortgang[];
  /** Het onderdeel dat nu geoefend wordt (null = sessie klaar). */
  actief: string | null;
}

const START_TARGET = 2;

/** Hoeveel goed er nodig is bij `target` gestelde opgaven (relaxeert naarmate het er meer worden). */
function vereistGoed(target: number): number {
  if (target <= 2) return target; // 2/2
  if (target === 4) return 3; // ≥3/4
  return Math.ceil(target / 2); // ≥50% over de hele set
}

/** Is een synthese-onderdeel vrijgespeeld? (alle losse onderdelen ✓). */
function syntheseVrij(voortgang: OnderdeelVoortgang[]): boolean {
  const losse = voortgang.filter((v) => !v.isSynthese);
  return losse.length > 0 && losse.every((v) => v.status === "klaar");
}

/** Kies het volgende te oefenen onderdeel (in volgorde; synthese pas na de losse). */
function kiesActief(state: Cat2State): string | null {
  const vrij = syntheseVrij(state.voortgang);
  for (const v of state.voortgang) {
    if (v.status === "klaar" || v.status === "deels") continue;
    if (v.isSynthese && !vrij) continue;
    return v.onderdeel;
  }
  return null;
}

/**
 * Start een Cat-2-sessie. `opgaven` bevat de (al geschudde) pool; de volgorde van
 * eerste verschijning bepaalt de onderdeel-volgorde. Synthese-onderdelen staan
 * vergrendeld tot de losse ✓ zijn.
 */
export function startCat2(opgaven: Cat2Opgave[]): Cat2State {
  const pools: Record<string, string[]> = {};
  const meta = new Map<string, { titel: string; isSynthese: boolean }>();
  const volgorde: string[] = [];
  for (const o of opgaven) {
    if (!pools[o.onderdeel]) {
      pools[o.onderdeel] = [];
      meta.set(o.onderdeel, { titel: o.onderdeelTitel, isSynthese: o.isSynthese });
      volgorde.push(o.onderdeel);
    }
    pools[o.onderdeel]!.push(o.id);
  }
  // Losse onderdelen vóór synthese, beide in verschijningsvolgorde.
  volgorde.sort((a, b) => {
    const sa = meta.get(a)!.isSynthese ? 1 : 0;
    const sb = meta.get(b)!.isSynthese ? 1 : 0;
    return sa - sb;
  });
  const voortgang: OnderdeelVoortgang[] = volgorde.map((onderdeel) => {
    const m = meta.get(onderdeel)!;
    return {
      onderdeel,
      titel: m.titel,
      isSynthese: m.isSynthese,
      gevraagd: 0,
      goed: 0,
      target: Math.min(START_TARGET, pools[onderdeel]!.length),
      poolGrootte: pools[onderdeel]!.length,
      status: m.isSynthese ? "vergrendeld" : "open",
    };
  });
  const state: Cat2State = { pools, voortgang, actief: null };
  state.actief = kiesActief(state);
  return state;
}

/** De id van de opgave die nu gemaakt moet worden (null als de sessie klaar is). */
export function huidigeOpgaveId(state: Cat2State): string | null {
  if (!state.actief) return null;
  const v = state.voortgang.find((x) => x.onderdeel === state.actief);
  if (!v) return null;
  return state.pools[state.actief]?.[v.gevraagd] ?? null;
}

/** Sessie klaar? (geen actief onderdeel meer te oefenen). */
export function isKlaarCat2(state: Cat2State): boolean {
  return state.actief === null;
}

/**
 * Verwerk een antwoord op de huidige opgave en bepaal de volgende stap.
 * Geeft een NIEUWE state terug (immutable-vriendelijk voor React).
 */
export function beantwoordCat2(state: Cat2State, goed: boolean): Cat2State {
  if (!state.actief) return state;
  const next: Cat2State = {
    pools: state.pools,
    actief: state.actief,
    voortgang: state.voortgang.map((v) => ({ ...v })),
  };
  const v = next.voortgang.find((x) => x.onderdeel === next.actief);
  if (!v) return next;

  v.gevraagd += 1;
  if (goed) v.goed += 1;

  // Beslis alleen op een batch-grens (zodra het toegezegde aantal gehaald is).
  if (v.gevraagd >= v.target) {
    if (v.goed >= vereistGoed(v.target)) {
      v.status = "klaar";
    } else if (v.target < v.poolGrootte) {
      // +2 extra opgaven (gecapt op de pool).
      v.target = Math.min(v.target + 2, v.poolGrootte);
    } else {
      // Pool op: afronden. ≥50% → klaar, anders deels (komt later gespreid terug).
      v.status = v.goed * 2 >= v.gevraagd ? "klaar" : "deels";
    }
  }

  // Vergrendelde synthese-onderdelen openzetten zodra de losse ✓ zijn.
  if (syntheseVrij(next.voortgang)) {
    for (const s of next.voortgang) if (s.isSynthese && s.status === "vergrendeld") s.status = "open";
  }

  next.actief = kiesActief(next);
  return next;
}
