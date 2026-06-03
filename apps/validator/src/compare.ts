import type { CompareResult, Fact, FactPaar } from "./types.js";
import { gelijkenis } from "./normalize.js";

/** Vanaf deze sleutel-gelijkenis beschouwen we twee facts als hetzelfde item. */
export const KOPPEL_DREMPEL = 0.82;

interface Kandidaat {
  ti: number;
  ri: number;
  sim: number;
}

/**
 * Bidirectionele vergelijking (SPEC §6 stap 3).
 *
 * Eerst worden facts één-op-één gekoppeld op sleutel-gelijkenis (hoogste eerst, greedy).
 * Dit voorkomt dat een OCR-/interpunctie-variant van hetzelfde item zowel als "missing"
 * als "hallucinated" wordt gerapporteerd — die hoort als (hooguit) mismatch te tellen.
 * Daarna:
 *  - ongekoppelde raw-fact  → missing      (gevaarlijk: stof die ontbreekt in de trainer)
 *  - ongekoppelde trainer-fact → hallucinated (verzonnen: niet terug te vinden in raw)
 *  - gekoppeld, gelijke waarde → matched
 *  - gekoppeld, andere waarde  → mismatch
 */
export function compareFacts(
  trainer: readonly Fact[],
  raw: readonly Fact[],
  koppelDrempel: number = KOPPEL_DREMPEL,
): CompareResult {
  const kandidaten: Kandidaat[] = [];
  for (let ti = 0; ti < trainer.length; ti++) {
    for (let ri = 0; ri < raw.length; ri++) {
      const sim = gelijkenis(trainer[ti]!.key, raw[ri]!.key);
      if (sim >= koppelDrempel) kandidaten.push({ ti, ri, sim });
    }
  }
  kandidaten.sort((a, b) => b.sim - a.sim);

  const gebruiktT = new Set<number>();
  const gebruiktR = new Set<number>();
  const matched: FactPaar[] = [];
  const mismatches: FactPaar[] = [];

  for (const { ti, ri, sim } of kandidaten) {
    if (gebruiktT.has(ti) || gebruiktR.has(ri)) continue;
    gebruiktT.add(ti);
    gebruiktR.add(ri);
    const t = trainer[ti]!;
    const r = raw[ri]!;
    const paar: FactPaar = { trainer: t, raw: r, gelijkenis: sim };
    if (t.value === r.value) matched.push(paar);
    else mismatches.push(paar);
  }

  const hallucinated = trainer.filter((_, ti) => !gebruiktT.has(ti));
  const missing = raw.filter((_, ri) => !gebruiktR.has(ri));

  return { missing, hallucinated, mismatches, matched };
}
