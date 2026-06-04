import { describe, expect, it } from "vitest";
import { combine } from "./verdict.js";
import type { SolveAttempt } from "./types.js";

function attempt(opts: Partial<SolveAttempt> & { rawAnswer: string }): SolveAttempt {
  return {
    solver: "A",
    canonical: "",
    confidence: 0.95,
    unparseable: false,
    ...opts,
  };
}

describe("combine — confidence tier bepaling", () => {
  it("HIGH bij exacte match + hoge zelf-confidence", () => {
    const a = attempt({ solver: "A", rawAnswer: "x=5", confidence: 0.97 });
    const b = attempt({ solver: "B", rawAnswer: "x = 5", confidence: 0.96 });
    const r = combine("opg-12a", a, b);
    expect(r.tier).toBe("HIGH");
    expect(r.answer).toBe("x=5");
    expect(r.acceptedForms).toContain("x=5");
  });

  it("MEDIUM bij exacte canonical-match + matige zelf-confidence", () => {
    const a = attempt({ solver: "A", rawAnswer: "x=5", confidence: 0.88 });
    const b = attempt({ solver: "B", rawAnswer: "x = 5", confidence: 0.90 });
    const r = combine("opg-12a", a, b);
    expect(r.tier).toBe("MEDIUM");
    expect(r.answer).toBe("x=5");
  });

  it("MEDIUM bij numerieke gelijkheid maar andere vorm", () => {
    const a = attempt({ solver: "A", rawAnswer: "0.5", confidence: 0.92 });
    const b = attempt({ solver: "B", rawAnswer: "1/2", confidence: 0.93 });
    const r = combine("opg-x", a, b);
    expect(r.tier).toBe("MEDIUM");
    expect(r.acceptedForms).toContain("0.5");
    expect(r.acceptedForms).toContain("1/2");
  });

  it("LOW als één solver unparseable rapporteert", () => {
    const a = attempt({ solver: "A", rawAnswer: "?", confidence: 0.2, unparseable: true });
    const b = attempt({ solver: "B", rawAnswer: "x=5", confidence: 0.95 });
    const r = combine("opg-x", a, b);
    expect(r.tier).toBe("LOW");
    expect(r.reason).toMatch(/parsen/);
  });

  it("LOW bij lage zelf-confidence van een solver", () => {
    const a = attempt({ solver: "A", rawAnswer: "x=5", confidence: 0.5 });
    const b = attempt({ solver: "B", rawAnswer: "x=5", confidence: 0.95 });
    const r = combine("opg-x", a, b);
    expect(r.tier).toBe("LOW");
    expect(r.reason).toMatch(/confidence/i);
  });

  it("LOW bij solver-disagreement", () => {
    const a = attempt({ solver: "A", rawAnswer: "x=5", confidence: 0.92 });
    const b = attempt({ solver: "B", rawAnswer: "x=6", confidence: 0.91 });
    const r = combine("opg-x", a, b);
    expect(r.tier).toBe("LOW");
    expect(r.reason).toMatch(/oneens/);
  });

  it("dedupes acceptedForms", () => {
    const a = attempt({ solver: "A", rawAnswer: "x=5", confidence: 0.97 });
    const b = attempt({ solver: "B", rawAnswer: "x=5", confidence: 0.97 });
    const r = combine("opg-x", a, b);
    const set = new Set(r.acceptedForms);
    expect(set.size).toBe(r.acceptedForms?.length);
  });
});
