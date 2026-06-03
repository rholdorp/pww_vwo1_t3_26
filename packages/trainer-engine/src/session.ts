import type { Uitkomst } from "@pww/shared";

/** Een fout item komt terug ná dit aantal andere items in dezelfde sessie (SPEC §5). */
export const REQUEUE_NA_ITEMS = 3;
/** Vanaf dit aantal fouten in één sessie schakelt een item naar hint-modus. */
export const HINT_DREMPEL = 2;

/** Sessie-ordening voor één Cat 1-blok. Puur in-memory, los van persistente Leitner-boxen. */
export interface SessionState {
  /** Komende items, in volgorde; index 0 is het huidige item. */
  remaining: readonly string[];
  /** Aantal fouten per item binnen deze sessie. */
  misses: Readonly<Record<string, number>>;
  /** Items die deze sessie minstens 1× goed zijn beantwoord. */
  cleared: readonly string[];
}

/** Start een sessie met items in de gegeven (bv. bakje-gesorteerde) volgorde. */
export function startSession(itemIds: readonly string[]): SessionState {
  return { remaining: [...itemIds], misses: {}, cleared: [] };
}

/** Het item dat nu aan de beurt is, of null als de sessie klaar is. */
export function currentItem(state: SessionState): string | null {
  return state.remaining[0] ?? null;
}

export function isComplete(state: SessionState): boolean {
  return state.remaining.length === 0;
}

/** Moet het huidige item met een hint getoond worden (≥2× fout deze sessie)? */
export function needsHint(state: SessionState, itemId: string): boolean {
  return (state.misses[itemId] ?? 0) >= HINT_DREMPEL;
}

/**
 * Verwerk de uitkomst van het huidige item.
 * - "goed": item verlaat de queue en gaat naar `cleared`.
 * - "fout"/"bijna": misses+1 en het item wordt opnieuw ingepland ná REQUEUE_NA_ITEMS
 *   andere items (of achteraan als er minder resteren). Een item verlaat de sessie pas
 *   als het 1× goed is — dit dekt ook de eindronde uit de SPEC.
 */
export function submit(state: SessionState, uitkomst: Uitkomst): SessionState {
  const id = state.remaining[0];
  if (id === undefined) return state;

  const rest = state.remaining.slice(1);

  if (uitkomst === "goed") {
    return { ...state, remaining: rest, cleared: [...state.cleared, id] };
  }

  const positie = Math.min(REQUEUE_NA_ITEMS, rest.length);
  const opnieuw = [...rest];
  opnieuw.splice(positie, 0, id);

  return {
    ...state,
    remaining: opnieuw,
    misses: { ...state.misses, [id]: (state.misses[id] ?? 0) + 1 },
  };
}
