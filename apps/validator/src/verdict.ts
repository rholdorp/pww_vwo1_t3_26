import type { CompareResult, Verdict } from "./types.js";
import type { CoverageResultaat } from "./coverage.js";

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

/**
 * Strikt Cat 1-oordeel o.b.v. de KEYLESS OCR-validatie (zie coverage.ts):
 *  - ongegrond (trainer-zijde niet in screenshots) → FAIL. Dit is hallucinated:
 *    de trainer beweert iets zonder zichtbare bron. Fail-safe richting (P8).
 *  - ongedekt (OCR-regel niet in trainer) → warning. Mogelijk gemiste stof, maar
 *    ruis-gevoelig (koppen/handschrift), dus menselijke review i.p.v. blokkade.
 */
export function verdictCat1Ocr(vak: string, c: CoverageResultaat): Verdict {
  const fouten: string[] = [];
  const warnings: string[] = [];

  if (c.gescandeImages === 0) {
    fouten.push(`Geen screenshots gevonden om ${vak} onafhankelijk te valideren.`);
  }
  if (c.ongegrond.length > 0) {
    fouten.push(
      `${c.ongegrond.length} trainer-zijde(s) niet terug te vinden in de screenshots (ongegrond/hallucinated).`,
    );
  }
  if (c.ongedekt.length > 0) {
    warnings.push(
      `${c.ongedekt.length} OCR-regel(s) niet teruggevonden in de trainer — controleer of dit toetsbare stof is.`,
    );
  }

  return { vak, strengheid: "strikt", pass: fouten.length === 0, fouten, warnings };
}
