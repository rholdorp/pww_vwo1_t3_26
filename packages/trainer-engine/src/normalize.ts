import type { NormalisatieProfiel, Uitkomst } from "@pww/shared";

const LEADING_ARTICLES = new Set([
  // NL
  "de",
  "het",
  "een",
  // FR
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Normaliseer een antwoord volgens het profiel, vóór vergelijking (SPEC §5 Cat 1). */
export function normalize(input: string, profiel: NormalisatieProfiel): string {
  // NFC eerst: visueel identieke accenten kunnen als precomposed (é) of als
  // e+combining-accent binnenkomen — zonder canonicalisatie zouden die als verschillend
  // tellen en een correct antwoord onterecht afkeuren.
  let s = input.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

  switch (profiel) {
    case "frans":
    case "exact":
      // Accenten blijven significant (été ≠ ete).
      break;
    case "zin":
      // Hele zinnen: accenten significant, maar zins-leestekens negeren zodat een
      // vergeten punt/vraagteken niet als fout telt. Apostrof en koppelteken blijven
      // (elisie/inversie: j'habite, qu'est-ce que, peux-tu).
      s = s.replace(/[.,;:!?«»""„"…]/g, " ").replace(/\s+/g, " ").trim();
      break;
    case "engels":
      // Accenten optioneel.
      s = stripAccents(s);
      break;
    case "begrip":
      // Toleranter: accenten weg, leestekens weg, één leidend lidwoord optioneel.
      s = stripAccents(s).replace(/[.,;:!?'""()\-]/g, " ").replace(/\s+/g, " ").trim();
      {
        const [first, ...rest] = s.split(" ");
        if (first !== undefined && rest.length > 0 && LEADING_ARTICLES.has(first)) {
          s = rest.join(" ");
        }
      }
      break;
  }
  return s;
}

/** Levenshtein-afstand (voor "bijna goed"-detectie). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1, // verwijdering
        (curr[j - 1] ?? 0) + 1, // invoeging
        (prev[j - 1] ?? 0) + cost, // vervanging
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

/** Bij hoeveel tekens verschil "bijna goed" geldt, per profiel. */
function nearMissDrempel(profiel: NormalisatieProfiel): number {
  switch (profiel) {
    case "frans":
      return 1; // strikt: alleen 1-teken-typo telt als "bijna"
    case "zin":
    case "engels":
    case "begrip":
      return 2; // langere antwoorden: iets meer coulance
    case "exact":
      return 0; // geen coulance
  }
}

/**
 * Beoordeel een getypt antwoord tegen de geaccepteerde vormen.
 * - "goed": exact (na normalisatie) gelijk aan één van de geaccepteerde vormen.
 * - "bijna": binnen de profiel-drempel aan tekens — telt als fout maar minder bestraffend.
 * - "fout": daarbuiten.
 */
export function gradeAnswer(
  input: string,
  accepted: string[],
  profiel: NormalisatieProfiel,
): Uitkomst {
  const genorm = normalize(input, profiel);
  if (genorm.length === 0) return "fout";

  const kandidaten = accepted.map((a) => normalize(a, profiel));
  if (kandidaten.includes(genorm)) return "goed";

  const drempel = nearMissDrempel(profiel);
  if (drempel > 0) {
    const minAfstand = Math.min(...kandidaten.map((k) => levenshtein(genorm, k)));
    if (minAfstand <= drempel) return "bijna";
  }
  return "fout";
}
