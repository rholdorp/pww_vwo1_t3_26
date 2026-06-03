import type { CompareResult, Verdict } from "./types.js";

/**
 * Pas de strikte Cat 1-regels toe (SPEC §6):
 *  - 0% missing/hallucinated — elk geval blokkeert publicatie (FAIL).
 *  - mismatch → warning: wel publiceren, rapport committen voor latere review.
 *
 * De missing-regel is de kern van P8: gemiste stof is precies wat eerder op de toets kwam.
 */
export function verdictCat1(vak: string, r: CompareResult): Verdict {
  const fouten: string[] = [];
  const warnings: string[] = [];

  if (r.missing.length > 0) {
    fouten.push(
      `${r.missing.length} item(s) uit de screenshots ontbreken in de trainer (missing).`,
    );
  }
  if (r.hallucinated.length > 0) {
    fouten.push(
      `${r.hallucinated.length} trainer-item(s) zijn niet terug te vinden in de screenshots (hallucinated).`,
    );
  }
  if (r.mismatches.length > 0) {
    warnings.push(
      `${r.mismatches.length} item(s) hebben een andere waarde dan de screenshot (mismatch).`,
    );
  }

  return { vak, strengheid: "strikt", pass: fouten.length === 0, fouten, warnings };
}
