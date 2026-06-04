/**
 * Math-solver — SPEC §4 Stage 2.5.
 *
 * Publieke API:
 *   solveOpgave(opgave) → Promise<SolveResult>
 *     Roept solver A + B parallel aan, combineert via verdict.ts.
 *   solveBatch(opgaven) → Promise<SolveResult[]>
 *     Loop over een lijst opgaven (sequentieel om rate-limits te respecteren).
 */

export type {
  Opgave,
  SolveAttempt,
  SolveResult,
  ConfidenceTier,
} from "./types.js";
export { TIER_THRESHOLDS } from "./types.js";
export { canonicalize, canonicalEqual, numericEqual } from "./canonical.js";
export { combine } from "./verdict.js";
export { runSolver } from "./runner.js";
export { POC_FIXTURES } from "./fixtures.js";

import type { Opgave, SolveResult, SolveAttempt } from "./types.js";
import { runSolver } from "./runner.js";
import { combine } from "./verdict.js";

const UNPARSEABLE_FALLBACK: Omit<SolveAttempt, "solver"> = {
  rawAnswer: "",
  canonical: "",
  confidence: 0,
  unparseable: true,
  notes: "Solver gaf geen bruikbaar antwoord (API/SDK ontbrak of fout in parse)",
};

export async function solveOpgave(opgave: Opgave): Promise<SolveResult> {
  const [a, b] = await Promise.all([
    runSolver(opgave, { solver: "A" }),
    runSolver(opgave, { solver: "B" }),
  ]);

  const attemptA: SolveAttempt = a ?? { solver: "A", ...UNPARSEABLE_FALLBACK };
  const attemptB: SolveAttempt = b ?? { solver: "B", ...UNPARSEABLE_FALLBACK };

  return combine(opgave.id, attemptA, attemptB);
}

export async function solveBatch(opgaven: Opgave[]): Promise<SolveResult[]> {
  const results: SolveResult[] = [];
  for (const opg of opgaven) {
    results.push(await solveOpgave(opg));
  }
  return results;
}
