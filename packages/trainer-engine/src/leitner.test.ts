import { describe, expect, it } from "vitest";
import type { ItemProgress } from "@pww/shared";
import {
  applyResult,
  daysBetween,
  isDue,
  mastery,
  nieuwItem,
} from "./leitner.js";

const item = (over: Partial<ItemProgress> = {}): ItemProgress => ({
  itemId: "x",
  box: 1,
  laatstGezien: "2026-06-01",
  aantalGoed: 0,
  aantalFout: 0,
  ...over,
});

describe("daysBetween", () => {
  it("telt hele dagen", () => {
    expect(daysBetween("2026-06-01", "2026-06-05")).toBe(4);
    expect(daysBetween("2026-06-05", "2026-06-05")).toBe(0);
  });
});

describe("isDue", () => {
  it("bakje 1 is altijd aan de beurt", () => {
    expect(isDue(item({ box: 1 }), "2026-06-01")).toBe(true);
  });
  it("bakje 3 wacht 4 dagen", () => {
    expect(isDue(item({ box: 3, laatstGezien: "2026-06-01" }), "2026-06-04")).toBe(false);
    expect(isDue(item({ box: 3, laatstGezien: "2026-06-01" }), "2026-06-05")).toBe(true);
  });
});

describe("applyResult", () => {
  it("goed promoveert en telt mee", () => {
    const na = applyResult(item({ box: 2 }), "goed", "2026-06-02");
    expect(na.box).toBe(3);
    expect(na.aantalGoed).toBe(1);
    expect(na.laatstGezien).toBe("2026-06-02");
  });

  it("goed plafonneert op bakje 5", () => {
    expect(applyResult(item({ box: 5 }), "goed", "2026-06-02").box).toBe(5);
  });

  it("fout zet terug naar bakje 1", () => {
    const na = applyResult(item({ box: 4 }), "fout", "2026-06-02");
    expect(na.box).toBe(1);
    expect(na.aantalFout).toBe(1);
  });

  it("bijna telt als fout", () => {
    expect(applyResult(item({ box: 4 }), "bijna", "2026-06-02").box).toBe(1);
  });
});

describe("mastery", () => {
  it("is de fractie items in bakje 3+", () => {
    expect(mastery([item({ box: 3 }), item({ box: 1 }), item({ box: 5 }), item({ box: 2 })])).toBe(
      0.5,
    );
  });
  it("is 0 zonder items", () => {
    expect(mastery([])).toBe(0);
  });
});

describe("nieuwItem", () => {
  it("start in bakje 1", () => {
    expect(nieuwItem("abc", "2026-06-01")).toEqual({
      itemId: "abc",
      box: 1,
      laatstGezien: "2026-06-01",
      aantalGoed: 0,
      aantalFout: 0,
    });
  });
});
