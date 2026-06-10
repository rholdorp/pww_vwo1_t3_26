/**
 * Cosmetische opschoning + strikte gelijkheid voor wiskunde-antwoorden (Cat 2).
 *
 * BELANGRIJK: dit is GEEN expressie-normalisator/CAS. Het geaccepteerde antwoord
 * is strikt het antwoordenboekje-antwoord (de simpelste vorm) — dat is precies het
 * leerdoel van H8 (vereenvoudigen). We rekenen alléén *cosmetische* verschillen
 * goed, geen wiskundige herschrijvingen:
 *   - superscript `²` → `^2`, whitespace, hoofd-/kleine letters, Unicode-min `−`→`-`,
 *     vermenigvuldig-tekens `· × ⋅` → `*`, decimaalkomma `3,5`→`3.5`;
 *   - getal/breuk/wetenschappelijke-notatie naar één canonieke waarde
 *     (`0.5`=`1/2`, `2/4`=`1/2`, `3,5·10^4`=`3.5*10^4`).
 *
 * Bewust NIET gelijk: `8(a+b)` ≠ `8a+8b`, `a+b` ≠ `b+a` (tenzij expliciet als
 * `acceptedForms` meegegeven), een niet-vereenvoudigde vorm telt als FOUT.
 */

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Probeer een (al opgeschoonde) string als getal/breuk/wet.-notatie te parsen. */
function parseNumber(clean: string): number | null {
  const breuk = clean.match(/^(-?\d+)\/(\d+)$/);
  if (breuk) {
    const teller = Number.parseInt(breuk[1] ?? "0", 10);
    const noemer = Number.parseInt(breuk[2] ?? "1", 10);
    if (noemer === 0) return null;
    return teller / noemer;
  }
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return Number.parseFloat(clean);
  }
  const wn = clean.match(/^(-?\d+(?:\.\d+)?)\*10\^(-?\d+)$/);
  if (wn) {
    return Number.parseFloat(wn[1] ?? "0") * 10 ** Number.parseInt(wn[2] ?? "0", 10);
  }
  return null;
}

/** Format een getal in canonieke vorm (gehele getallen kaal, anders kleinste breuk). */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  for (let d = 2; d <= 1000; d++) {
    const t = n * d;
    if (Math.abs(t - Math.round(t)) < 1e-9) {
      const teller = Math.round(t);
      const g = gcd(Math.abs(teller), d);
      return `${teller / g}/${d / g}`;
    }
  }
  return n.toFixed(6).replace(/\.?0+$/, "");
}

/**
 * Schoon een wiskunde-antwoord cosmetisch op (geen herschrijvingen). Het resultaat
 * is een vergelijkbare string: gelijke cosmetische varianten → gelijke output.
 */
export function schoonWiskunde(raw: string): string {
  if (!raw) return "";
  let s = raw.normalize("NFC");
  // Superscript-reeksen (²  ³ ⁴ …) → ^digits, bv. "36a²" → "36a^2", "10⁴" → "10^4".
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPT[c] ?? "").join(""));
  // Decimaalkomma → punt (Nederlands), alleen tussen cijfers ("3,5" → "3.5").
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  s = s.replace(/−/g, "-"); // Unicode MINUS SIGN → ASCII -
  s = s.replace(/[×⋅·]/g, "*"); // ×, ⋅ (U+22C5), · (U+00B7) → *
  s = s.replace(/\s+/g, "");
  return s.toLowerCase();
}

/** Cosmetisch + getal-canonical. Pure getallen/breuken → één canonieke waarde. */
function canon(raw: string): string {
  const clean = schoonWiskunde(raw);
  const n = parseNumber(clean);
  return n === null ? clean : formatNumber(n);
}

/**
 * Strikte wiskunde-gelijkheid: is `input` (na cosmetische opschoning) gelijk aan
 * `antwoord` of een van de expliciet toegestane `acceptedForms`?
 * Geen wiskundige equivalentie — een niet-vereenvoudigde vorm is fout.
 *
 * `exacteVorm`: alléén cosmetische opschoning, GEEN getal-/breuk-canonical. Nodig
 * waar de gevraagde VORM telt en niet de waarde — bv. wetenschappelijke notatie:
 * `4,8·10^5` moet goed zijn, maar de waarde `480000` fout (niet in die vorm).
 */
export function wiskundeGelijk(
  input: string,
  antwoord: string,
  acceptedForms: string[] = [],
  exacteVorm = false,
): boolean {
  const f = exacteVorm ? schoonWiskunde : canon;
  const genorm = f(input);
  if (genorm.length === 0) return false;
  return [antwoord, ...acceptedForms].some((t) => f(t) === genorm);
}
