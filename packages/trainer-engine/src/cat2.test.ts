import { describe, expect, it } from "vitest";
import {
  startCat2,
  huidigeOpgaveId,
  isKlaarCat2,
  beantwoordCat2,
  type Cat2Opgave,
  type Cat2State,
} from "./cat2.js";

// Bouw een pool: n opgaven voor een onderdeel.
function pool(onderdeel: string, titel: string, n: number, isSynthese = false): Cat2Opgave[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${onderdeel}-${i}`,
    onderdeel,
    onderdeelTitel: titel,
    isSynthese,
  }));
}

// Beantwoord de huidige opgave met een vaste uitkomst; geeft de nieuwe state.
function antwoord(state: Cat2State, goed: boolean): Cat2State {
  expect(huidigeOpgaveId(state)).not.toBeNull();
  return beantwoordCat2(state, goed);
}

function statusVan(state: Cat2State, onderdeel: string) {
  return state.voortgang.find((v) => v.onderdeel === onderdeel)!.status;
}

describe("Cat-2 — onderdeel-flow", () => {
  it("2/2 goed → onderdeel klaar, door naar het volgende", () => {
    let s = startCat2([...pool("8.1", "§8.1", 6), ...pool("8.2", "§8.2", 6)]);
    expect(s.actief).toBe("8.1");
    s = antwoord(s, true);
    s = antwoord(s, true);
    expect(statusVan(s, "8.1")).toBe("klaar");
    expect(s.actief).toBe("8.2");
  });

  it("1/2 → +2; bij 3/4 → klaar", () => {
    let s = startCat2(pool("8.1", "§8.1", 6));
    s = antwoord(s, true); // 1/1
    s = antwoord(s, false); // 1/2
    expect(statusVan(s, "8.1")).toBe("open"); // verlengd, nog niet klaar
    expect(s.voortgang[0]!.target).toBe(4);
    s = antwoord(s, true); // 2/3
    s = antwoord(s, true); // 3/4 → klaar
    expect(statusVan(s, "8.1")).toBe("klaar");
  });

  it("0/2 → +2 extra; haalt ≥50% over de set → klaar", () => {
    let s = startCat2(pool("8.1", "§8.1", 8));
    s = antwoord(s, false); // 0/1
    s = antwoord(s, false); // 0/2 → +2
    expect(s.voortgang[0]!.target).toBe(4);
    s = antwoord(s, true); // 1/3
    s = antwoord(s, true); // 2/4 → <3 → +2
    expect(s.voortgang[0]!.target).toBe(6);
    s = antwoord(s, true); // 3/5
    s = antwoord(s, true); // 4/6 → ≥3 (≥50%) → klaar
    expect(statusVan(s, "8.1")).toBe("klaar");
  });

  it("pool op zonder ≥50% → deels (komt later terug, telt niet als klaar)", () => {
    let s = startCat2(pool("8.1", "§8.1", 4));
    s = antwoord(s, false); // 0/1
    s = antwoord(s, false); // 0/2 → +2 (target=4 = pool)
    s = antwoord(s, false); // 0/3
    s = antwoord(s, false); // 0/4, pool op, <50% → deels
    expect(statusVan(s, "8.1")).toBe("deels");
  });
});

describe("Cat-2 — synthese-lock", () => {
  it("synthese-onderdeel blijft vergrendeld tot alle losse ✓; wordt dan geoefend", () => {
    const opg = [
      ...pool("8.1", "§8.1", 2),
      ...pool("8.2", "§8.2", 2),
      ...pool("8.S", "Synthese", 2, true),
    ];
    let s = startCat2(opg);
    expect(statusVan(s, "8.S")).toBe("vergrendeld");
    // 8.1 klaar
    s = antwoord(s, true);
    s = antwoord(s, true);
    // synthese mag nog niet — 8.2 nog open
    expect(s.actief).toBe("8.2");
    expect(statusVan(s, "8.S")).toBe("vergrendeld");
    // 8.2 klaar → synthese vrij
    s = antwoord(s, true);
    s = antwoord(s, true);
    expect(statusVan(s, "8.S")).toBe("open");
    expect(s.actief).toBe("8.S");
    // synthese afmaken
    s = antwoord(s, true);
    s = antwoord(s, true);
    expect(isKlaarCat2(s)).toBe(true);
  });

  it("synthese blijft onbereikbaar als een los onderdeel 'deels' eindigt", () => {
    const opg = [...pool("8.1", "§8.1", 2), ...pool("8.S", "Synthese", 2, true)];
    let s = startCat2(opg);
    s = antwoord(s, false); // 0/1
    s = antwoord(s, false); // 0/2, pool op → deels
    expect(statusVan(s, "8.1")).toBe("deels");
    expect(statusVan(s, "8.S")).toBe("vergrendeld");
    expect(isKlaarCat2(s)).toBe(true); // niets meer te oefenen
  });
});

describe("Cat-2 — invarianten", () => {
  it("huidigeOpgaveId loopt door de pool en is null bij klaar", () => {
    let s = startCat2(pool("8.1", "§8.1", 2));
    const eerste = huidigeOpgaveId(s);
    s = beantwoordCat2(s, true);
    const tweede = huidigeOpgaveId(s);
    expect(eerste).not.toBe(tweede);
    s = beantwoordCat2(s, true);
    expect(huidigeOpgaveId(s)).toBeNull();
    expect(isKlaarCat2(s)).toBe(true);
  });

  it("beantwoordCat2 muteert de oude state niet", () => {
    const s0 = startCat2(pool("8.1", "§8.1", 4));
    const s1 = beantwoordCat2(s0, true);
    expect(s0.voortgang[0]!.gevraagd).toBe(0);
    expect(s1.voortgang[0]!.gevraagd).toBe(1);
  });
});
