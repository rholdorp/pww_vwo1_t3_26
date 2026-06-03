import { describe, expect, it } from "vitest";
import { coverageVoorVak, schoonRegel } from "./coverage.js";
import { normKey, normValue } from "./normalize.js";
import type { Fact } from "./types.js";

const f = (nl: string, vreemd: string): Fact => ({
  key: normKey(nl),
  value: normValue(vreemd),
  bronKey: nl,
  bronValue: vreemd,
});

const trainer: Fact[] = [
  f("Met wie?", "Avec qui?"),
  f("Dat is mijn neef.", "C'est mon cousin."),
  f("Hij draagt een bril.", "Il porte des lunettes."),
];

// Faux-OCR: geef per "image"-pad een vaste regelset terug.
function fakeOcr(regels: Record<string, string[]>): (p: string) => string[] {
  return (p) => regels[p] ?? [];
}

describe("schoonRegel", () => {
  it("strip opsommingstekens en losse O-bullets", () => {
    expect(schoonRegel("• Met wie?")).toBe("Met wie?");
    expect(schoonRegel("O Avec qui?")).toBe("Avec qui?");
    expect(schoonRegel("|l est grand?")).toBe("l est grand?");
  });

  it("laat een woord dat met O begint ongemoeid", () => {
    expect(schoonRegel("Oui, c'était génial.")).toBe("Oui, c'était génial.");
  });
});

describe("coverageVoorVak", () => {
  it("alle gedrukte regels gedekt → niets ter review", () => {
    const ocr = fakeOcr({
      "img1.jpg": ["• Met wie?", "Avec qui?", "Dat is mijn neef.", "C'est mon cousin."],
    });
    const r = coverageVoorVak(["img1.jpg"], ocr, trainer);
    expect(r.ongedekt).toHaveLength(0);
    expect(r.gedekt).toBe(4);
  });

  it("tolereert OCR-ruis via fuzzy/containment-match", () => {
    // "Il" verkeerd als "ll"/"|l" gelezen — moet alsnog dekken.
    const ocr = fakeOcr({ "img.jpg": ["|l porte des lunettes."] });
    const r = coverageVoorVak(["img.jpg"], ocr, trainer);
    expect(r.ongedekt).toHaveLength(0);
  });

  it("FLAGT een regel die nergens in de trainer staat (mogelijk gemiste stof)", () => {
    const ocr = fakeOcr({
      "img.jpg": ["Met wie?", "Ik hou van kaas.", "J'aime le fromage."],
    });
    const r = coverageVoorVak(["img.jpg"], ocr, trainer);
    const teksten = r.ongedekt.map((o) => o.regel);
    expect(teksten).toContain("Ik hou van kaas.");
    expect(teksten).toContain("J'aime le fromage.");
  });

  it("negeert te korte regels (paginanummers, losse symbolen)", () => {
    const ocr = fakeOcr({ "img.jpg": ["42", "•", "O", "Met wie?"] });
    const r = coverageVoorVak(["img.jpg"], ocr, trainer);
    expect(r.beschouwdeRegels).toBe(1);
    expect(r.ongedekt).toHaveLength(0);
  });

  it("dedupliceert identieke regels over meerdere screenshots", () => {
    const ocr = fakeOcr({
      a: ["Onbekende kop"],
      b: ["Onbekende kop"],
    });
    const r = coverageVoorVak(["a", "b"], ocr, trainer);
    expect(r.ongedekt).toHaveLength(1);
    expect(r.gescandeImages).toBe(2);
  });
});

describe("coverageVoorVak — reverse (ongegrond/hallucinated)", () => {
  it("alle trainer-zijden gegrond → niets ongegrond", () => {
    const ocr = fakeOcr({
      "img.jpg": [
        "Met wie?", "Avec qui?",
        "Dat is mijn neef.", "C'est mon cousin.",
        "Hij draagt een bril.", "Il porte des lunettes.",
      ],
    });
    const r = coverageVoorVak(["img.jpg"], ocr, trainer);
    expect(r.ongegrond).toHaveLength(0);
    expect(r.gegrond).toBe(r.trainerZijden);
  });

  it("FLAGT een trainer-zijde die tekstueel niet in de screenshots staat", () => {
    // Trainer beweert een vertaling die nergens op de pagina voorkomt.
    const fout = [
      f("Met wie?", "Avec qui?"),
      f("Ik hou van kaas.", "J'aime le fromage."),
    ];
    const ocr = fakeOcr({ "img.jpg": ["Met wie?", "Avec qui?"] });
    const r = coverageVoorVak(["img.jpg"], ocr, fout);
    const teksten = r.ongegrond.map((o) => o.tekst);
    expect(teksten).toContain("Ik hou van kaas.");
    expect(teksten).toContain("J'aime le fromage.");
  });

  it("LIMIET: een tekstueel nabije mismatch (ma/mon) glipt erdoor — daarvoor is --extract", () => {
    // "C'est ma cousine" ≈ "C'est mon cousin": te dichtbij voor regel-matching.
    // Bewust gedocumenteerd: subtiele mismatch vereist de paar-diff, niet OCR.
    const fout = [f("Dat is mijn neef.", "C'est ma cousine.")];
    const ocr = fakeOcr({ "img.jpg": ["Dat is mijn neef.", "C'est mon cousin."] });
    const r = coverageVoorVak(["img.jpg"], ocr, fout);
    expect(r.ongegrond).toHaveLength(0);
  });

  it("tolereert OCR-ruis bij het gronden van trainer-zijden", () => {
    const ocr = fakeOcr({ "img.jpg": ["|l porte des lunettes.", "Hij draagt een bril."] });
    const one = [f("Hij draagt een bril.", "Il porte des lunettes.")];
    const r = coverageVoorVak(["img.jpg"], ocr, one);
    expect(r.ongegrond).toHaveLength(0);
  });
});
