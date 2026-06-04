/**
 * Bepaal de confidence-tier op basis van twee solver-pogingen.
 *
 * Volgens SPEC §4 Stage 2.5:
 *   HIGH   (≥0.95) — Beide solvers exact eens, symbolisch én numeriek
 *   MEDIUM (0.7-0.94) — Eens op afgerond numeriek antwoord maar verschillende vorm
 *   LOW    (<0.7) — Solvers oneens, of een solver gaf zelf onzekerheid aan,
 *                   of opgave had unparseable tekst
 *
 * LOW-resultaten gaan naar de review-queue (Ralph confirmt of corrigeert).
 */

import { canonicalEqual, canonicalize, numericEqual } from "./canonical.js";
import { TIER_THRESHOLDS, type SolveAttempt, type SolveResult } from "./types.js";

export function combine(
  opgaveId: string,
  a: SolveAttempt,
  b: SolveAttempt
): SolveResult {
  const attempts: [SolveAttempt, SolveAttempt] = [a, b];

  // Stap 1: unparseable van een van beide → LOW
  if (a.unparseable || b.unparseable) {
    return {
      opgaveId,
      attempts,
      tier: "LOW",
      confidence: Math.min(a.confidence, b.confidence),
      reason: a.unparseable && b.unparseable
        ? "Beide solvers konden de opgave niet parsen — review nodig"
        : `Solver ${a.unparseable ? "A" : "B"} kon de opgave niet parsen — review nodig`,
    };
  }

  // Stap 2: solver-self-confidence laag → LOW (signaal van twijfel)
  const minConfidence = Math.min(a.confidence, b.confidence);
  if (minConfidence < TIER_THRESHOLDS.MEDIUM_MIN) {
    return {
      opgaveId,
      attempts,
      tier: "LOW",
      confidence: minConfidence,
      reason: `Eigen solver-confidence < ${TIER_THRESHOLDS.MEDIUM_MIN} (${a.confidence.toFixed(2)} / ${b.confidence.toFixed(2)}) — review nodig`,
    };
  }

  // Stap 3: exacte canonical-match → HIGH (als beide self-confidence >= 0.95)
  if (canonicalEqual(a.rawAnswer, b.rawAnswer)) {
    const tier = minConfidence >= TIER_THRESHOLDS.HIGH_MIN ? "HIGH" : "MEDIUM";
    const canon = canonicalize(a.rawAnswer);
    return {
      opgaveId,
      attempts,
      answer: canon,
      acceptedForms: dedupe([canon, a.rawAnswer.trim(), b.rawAnswer.trim()]),
      tier,
      confidence: agreementBoost(minConfidence, 1.0),
      reason: tier === "HIGH"
        ? "Beide solvers exact eens (canonical-match) + hoge zelf-confidence"
        : "Beide solvers eens, maar minstens één met matige zelf-confidence",
    };
  }

  // Stap 4: numerieke gelijkheid maar andere vorm → MEDIUM
  if (numericEqual(a.rawAnswer, b.rawAnswer)) {
    const canon = canonicalize(a.rawAnswer);
    return {
      opgaveId,
      attempts,
      answer: canon,
      acceptedForms: dedupe([canon, canonicalize(b.rawAnswer), a.rawAnswer.trim(), b.rawAnswer.trim()]),
      tier: "MEDIUM",
      confidence: agreementBoost(minConfidence, 0.85),
      reason: "Numeriek eens maar verschillende vorm — vorm-keuze door reviewer",
    };
  }

  // Stap 5: disagreement → LOW
  return {
    opgaveId,
    attempts,
    tier: "LOW",
    confidence: minConfidence * 0.5,
    reason: `Solvers oneens: A="${a.rawAnswer}" vs B="${b.rawAnswer}" — review nodig`,
  };
}

/**
 * Combineer de zwakste solver-confidence met agreement-factor (hoe sterk eens).
 * Volledige overeenstemming kan een mid-confidence solver omhoog tillen, maar
 * een zwakke solver-confidence blijft de bovengrens.
 */
function agreementBoost(minSelf: number, agreement: number): number {
  // Zwakkere solver-confidence is de bovengrens; agreement verhoogt het minimum
  // tot een vloer van 0.7 (MEDIUM). Bv. self=0.92 + full agreement → 0.92.
  return Math.min(1, Math.max(minSelf, 0.7 * agreement));
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
