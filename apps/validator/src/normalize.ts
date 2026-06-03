import { levenshtein } from "@pww/trainer-engine";

/**
 * Normaliseer een sleutel voor het kóppelen van facts (identiteit-zijde).
 * Bewust toleranter dan antwoord-grading: accenten weg, leestekens weg — twee facts
 * die hetzelfde item beschrijven moeten koppelen ondanks OCR-/interpunctie-ruis.
 */
export function normKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.,;:!?'""«»()¿¡\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliseer een waarde voor het vergelíjken van antwoorden (waarde-zijde).
 * Behoudt accenten: een accent-verschil in het antwoord is een echte mismatch.
 */
export function normValue(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();
}

/** Sleutel-gelijkenis 0..1 op basis van Levenshtein (1 = identiek). */
export function gelijkenis(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}
