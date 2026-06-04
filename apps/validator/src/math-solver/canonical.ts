/**
 * Canonicalisatie van wiskunde-antwoorden voor cross-check vergelijking.
 *
 * Doel: twee solvers kunnen hetzelfde antwoord in verschillende vorm geven
 * (`x=5` vs `5`, `x = 5` vs `x=5`, `1/2` vs `0.5`). De canonical-vorm
 * verwijdert deze cosmetische verschillen zodat we kunnen vergelijken.
 *
 * **Niet** een algemene math-equivalentie-checker — voor symbolische gelijkheid
 * via sympy moeten we in de solver-call zelf vragen om sympy.simplify. Hier
 * vangen we de eenvoudige cases af.
 */

/** Strip whitespace, lowercase, vervang Unicode-min door ASCII-min. */
function cleanup(s: string): string {
  return s
    .replace(/−/g, "-") // Unicode MINUS SIGN → ASCII -
    .replace(/×|⋅/g, "*") // × · → *
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Probeer als getal te parsen (regular of breuk a/b). Return null bij failure. */
function parseNumber(s: string): number | null {
  const clean = cleanup(s);
  // Breuk?
  const breuk = clean.match(/^(-?\d+)\/(\d+)$/);
  if (breuk) {
    const teller = Number.parseInt(breuk[1] ?? "0", 10);
    const noemer = Number.parseInt(breuk[2] ?? "1", 10);
    if (noemer === 0) return null;
    return teller / noemer;
  }
  // Direct getal (int of float)?
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return Number.parseFloat(clean);
  }
  // Wetenschappelijke notatie a*10^n of a×10^n?
  const wn = clean.match(/^(-?\d+(?:\.\d+)?)\*10\^(-?\d+)$/);
  if (wn) {
    return Number.parseFloat(wn[1] ?? "0") * 10 ** Number.parseInt(wn[2] ?? "0", 10);
  }
  return null;
}

/** Format een getal of breuk in canonieke vorm. */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Eenvoudige breuk-detectie via best rational approximation tot noemer 1000
  for (let d = 2; d <= 1000; d++) {
    const t = n * d;
    if (Math.abs(t - Math.round(t)) < 1e-9) {
      const teller = Math.round(t);
      // Vereenvoudig
      const g = gcd(Math.abs(teller), d);
      return `${teller / g}/${d / g}`;
    }
  }
  // Anders: float (rond op 6 decimalen)
  return n.toFixed(6).replace(/\.?0+$/, "");
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Canonicaliseer een antwoord-string. Voorbeelden:
 *   "x = 5"      → "x=5"
 *   "5"          → "x=5" (als hint = "x=…")
 *   "x = -2, x = 3" → "x=-2,x=3"
 *   "1/2"        → "1/2"
 *   "0.5"        → "1/2"
 *   "2/4"        → "1/2"
 *   "1,5 * 10^4" → "1.5*10^4" (komma → punt)
 */
export function canonicalize(raw: string): string {
  if (!raw) return "";
  // Decimaalkomma → decimaalpunt (Nederlands gebruik)
  let s = raw.replace(/(\d),(\d)/g, "$1.$2");
  s = cleanup(s);

  // Multi-oplossing "x=-2,x=3" → sorteren
  if (s.includes(",x=") || /^x=/.test(s)) {
    const opgesplitst = s.split(",").map((p) => (p.startsWith("x=") ? p : `x=${p}`));
    const waarden = opgesplitst
      .map((p) => p.slice(2))
      .map((v) => {
        const n = parseNumber(v);
        return n === null ? v : formatNumber(n);
      })
      .sort((a, b) => {
        const na = Number.parseFloat(a);
        const nb = Number.parseFloat(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.localeCompare(b);
      });
    return waarden.map((v) => `x=${v}`).join(",");
  }

  // Pure getalwaarde
  const n = parseNumber(s);
  if (n !== null) {
    return formatNumber(n);
  }

  return s;
}

/**
 * Numerieke gelijkheid binnen tolerantie. Voor MEDIUM-tier wanneer twee solvers
 * dezelfde *waarde* geven maar in andere *vorm* (bv "0.5" vs "1/2").
 */
export function numericEqual(a: string, b: string, epsilon = 1e-6): boolean {
  const na = parseNumber(canonicalize(a));
  const nb = parseNumber(canonicalize(b));
  if (na === null || nb === null) return false;
  if (na === 0 || nb === 0) return Math.abs(na - nb) < epsilon;
  return Math.abs((na - nb) / Math.max(Math.abs(na), Math.abs(nb))) < epsilon;
}

/** Exacte canonical-match. */
export function canonicalEqual(a: string, b: string): boolean {
  return canonicalize(a) === canonicalize(b);
}
