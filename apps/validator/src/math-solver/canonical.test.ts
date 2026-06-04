import { describe, expect, it } from "vitest";
import { canonicalEqual, canonicalize, numericEqual } from "./canonical.js";

describe("canonicalize", () => {
  it("strips spaces and lowercases", () => {
    expect(canonicalize("X = 5")).toBe("x=5");
    expect(canonicalize("  x=5 ")).toBe("x=5");
  });

  it("normalizes pure numbers (no 'x=' prefix)", () => {
    expect(canonicalize("5")).toBe("5");
    expect(canonicalize("0.5")).toBe("1/2");
    expect(canonicalize("2/4")).toBe("1/2");
  });

  it("normalizes Unicode minus", () => {
    expect(canonicalize("x = −2")).toBe("x=-2");
  });

  it("converts Dutch decimal comma", () => {
    expect(canonicalize("0,5")).toBe("1/2");
  });

  it("sorts multi-solutions", () => {
    expect(canonicalize("x=3,x=-2")).toBe("x=-2,x=3");
    expect(canonicalize("x = -2, x = 3")).toBe("x=-2,x=3");
  });

  it("preserves polynomial form (no further simplification)", () => {
    // Polynomial canonicalisation is intentionally limited — depends on solver
    // returning canonical form. We only strip whitespace + lowercase here.
    expect(canonicalize("x^2 + 3*x - 4")).toBe("x^2+3*x-4");
  });
});

describe("canonicalEqual", () => {
  it("matches equivalent forms", () => {
    expect(canonicalEqual("x = 5", "x=5")).toBe(true);
    expect(canonicalEqual("5", "5")).toBe(true);
    expect(canonicalEqual("0.5", "1/2")).toBe(true);
    expect(canonicalEqual("2/4", "1/2")).toBe(true);
  });

  it("rejects different answers", () => {
    expect(canonicalEqual("x=5", "x=6")).toBe(false);
    expect(canonicalEqual("x=5", "5")).toBe(false); // "5" zonder 'x=' is iets anders
  });

  it("handles multi-solutions order-independent", () => {
    expect(canonicalEqual("x=3,x=-2", "x=-2,x=3")).toBe(true);
  });
});

describe("numericEqual", () => {
  it("matches numerically equivalent rationals", () => {
    expect(numericEqual("0.5", "1/2")).toBe(true);
    expect(numericEqual("0.333333", "1/3")).toBe(true);
  });

  it("matches within epsilon tolerance", () => {
    expect(numericEqual("0.5000001", "1/2", 1e-5)).toBe(true);
    expect(numericEqual("0.501", "1/2", 1e-5)).toBe(false);
  });

  it("returns false for non-numeric inputs", () => {
    expect(numericEqual("x^2", "x^2")).toBe(false);
  });
});
