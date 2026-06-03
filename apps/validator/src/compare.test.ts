import { describe, expect, it } from "vitest";
import { compareFacts } from "./compare.js";
import { verdictCat1 } from "./verdict.js";
import { normKey, normValue } from "./normalize.js";
import type { Fact } from "./types.js";

const f = (nl: string, vreemd: string): Fact => ({
  key: normKey(nl),
  value: normValue(vreemd),
  bronKey: nl,
  bronValue: vreemd,
});

// Een kleine, gedeelde "raw" set zoals een vision-model die uit een screenshot zou halen.
const raw: Fact[] = [
  f("Met wie?", "Avec qui?"),
  f("Dat is mijn neef.", "C'est mon cousin."),
  f("Hij draagt een bril.", "Il porte des lunettes."),
];

describe("compareFacts", () => {
  it("identieke sets: alles matched, geen fouten", () => {
    const r = compareFacts(raw, raw);
    expect(r.matched).toHaveLength(3);
    expect(r.missing).toHaveLength(0);
    expect(r.hallucinated).toHaveLength(0);
    expect(r.mismatches).toHaveLength(0);
    expect(verdictCat1("frans", r).pass).toBe(true);
  });

  it("DETECTEERT gemiste stof: item in raw maar niet in trainer", () => {
    const trainer = raw.slice(0, 2); // "Hij draagt een bril" weggelaten
    const r = compareFacts(trainer, raw);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0]!.bronKey).toBe("Hij draagt een bril.");
    const v = verdictCat1("frans", r);
    expect(v.pass).toBe(false);
    expect(v.fouten.join(" ")).toContain("missing");
  });

  it("DETECTEERT verzonnen stof: item in trainer maar niet in raw", () => {
    const trainer = [...raw, f("Ik hou van kaas.", "J'aime le fromage.")];
    const r = compareFacts(trainer, raw);
    expect(r.hallucinated).toHaveLength(1);
    expect(r.hallucinated[0]!.bronKey).toBe("Ik hou van kaas.");
    expect(verdictCat1("frans", r).pass).toBe(false);
  });

  it("DETECTEERT verkeerde vertaling als mismatch (warning, geen blok)", () => {
    const trainer = [
      f("Met wie?", "Avec qui?"),
      f("Dat is mijn neef.", "C'est ma cousine."), // verkeerd: neef ≠ cousine
      f("Hij draagt een bril.", "Il porte des lunettes."),
    ];
    const r = compareFacts(trainer, raw);
    expect(r.mismatches).toHaveLength(1);
    expect(r.missing).toHaveLength(0);
    expect(r.hallucinated).toHaveLength(0);
    const v = verdictCat1("frans", r);
    expect(v.pass).toBe(true); // mismatch blokkeert niet
    expect(v.warnings.join(" ")).toContain("mismatch");
  });

  it("koppelt OCR-/interpunctie-varianten i.p.v. dubbel te rapporteren", () => {
    // Zelfde item, sleutel licht anders gespeld door de vision-OCR.
    const trainer = [f("Met wie", "Avec qui?")]; // geen vraagteken in NL
    const onlyOne: Fact[] = [f("Met wie?", "Avec qui?")];
    const r = compareFacts(trainer, onlyOne);
    expect(r.matched).toHaveLength(1);
    expect(r.missing).toHaveLength(0);
    expect(r.hallucinated).toHaveLength(0);
  });

  it("een echt ander item koppelt niet (blijft missing)", () => {
    const trainer = [f("Met wie?", "Avec qui?")];
    const r = compareFacts(trainer, [f("Met wie?", "Avec qui?"), f("Hoe oud ben je?", "Quel âge as-tu?")]);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0]!.bronKey).toBe("Hoe oud ben je?");
  });
});
