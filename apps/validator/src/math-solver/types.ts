/**
 * Math-solver types (SPEC §4 Stage 2.5).
 *
 * Voor wiskunde-content uit Getal & Ruimte: het leerlingboek geeft de antwoorden niet,
 * dus moet de pipeline zelf afleiden — met expliciete confidence en menselijke review
 * bij twijfel (LOW). Twee onafhankelijke Claude-calls solven elk de opgave; een
 * canonicalisatie + vergelijkingstap bepaalt de confidence-tier.
 */

export interface Opgave {
  /** Stable id, bv. "wi-h3p2-12a". */
  id: string;
  /** De opgave-tekst zoals uit raw geëxtraheerd. */
  vraag: string;
  /** Optionele context (paragraaf, onderdeel, etc.). */
  context?: {
    hoofdstuk?: string;
    paragraaf?: string;
    onderdeel?: string;
    opgavenummer?: string;
    bron?: string;
  };
}

/** Eén poging van één solver. */
export interface SolveAttempt {
  /** Welke prompt — "A" of "B". */
  solver: "A" | "B";
  /** Het ruwe antwoord zoals teruggegeven door de solver, vóór canonicalisatie. */
  rawAnswer: string;
  /** Canoniek-genormaliseerd antwoord (voor vergelijking). */
  canonical: string;
  /** De zelf-gerapporteerde confidence van de solver, 0..1. */
  confidence: number;
  /** True als de solver de opgave niet kon parsen / interpreteren. */
  unparseable: boolean;
  /** Korte uitleg / methode-omschrijving (vooral voor review-rapport). */
  notes?: string;
}

export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

/** Eindresultaat na A + B + vergelijking. */
export interface SolveResult {
  opgaveId: string;
  attempts: [SolveAttempt, SolveAttempt];
  /** Antwoord dat we als "het antwoord" beschouwen (alleen bij HIGH/MEDIUM gevuld). */
  answer?: string;
  /** Acceptable alternative forms (canonieke vorm + originele rawAnswers). */
  acceptedForms?: string[];
  /** Tier-bepaling. */
  tier: ConfidenceTier;
  /** 0..1, samengestelde confidence (lager van A en B + agreement-factor). */
  confidence: number;
  /** Reden voor tier (vooral voor LOW: waarom review nodig is). */
  reason: string;
}

/** Drempels per SPEC §4 Stage 2.5 — confidence-tabel. */
export const TIER_THRESHOLDS = {
  /** Beide solvers exact eens, symbolisch én numeriek. */
  HIGH_MIN: 0.95,
  /** Eens op numeriek antwoord (afgerond), mogelijk andere vorm. */
  MEDIUM_MIN: 0.7,
} as const;
