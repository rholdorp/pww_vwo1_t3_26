import { describe, expect, it } from "vitest";
import { gradeAnswer, levenshtein, normalize } from "./normalize.js";

describe("normalize", () => {
  it("trimt, verlaagt kast en plet whitespace", () => {
    expect(normalize("  Le   Chat  ", "frans")).toBe("le chat");
  });

  it("frans behoudt accenten", () => {
    expect(normalize("Été", "frans")).toBe("été");
  });

  it("engels strijkt accenten weg", () => {
    expect(normalize("Café", "engels")).toBe("cafe");
  });

  it("begrip negeert leestekens en één leidend lidwoord", () => {
    expect(normalize("de cel.", "begrip")).toBe("cel");
    expect(normalize("Het skelet!", "begrip")).toBe("skelet");
  });

  it("begrip houdt lidwoord als er niets achter staat", () => {
    expect(normalize("de", "begrip")).toBe("de");
  });
});

describe("levenshtein", () => {
  it("is 0 voor gelijke strings", () => {
    expect(levenshtein("maison", "maison")).toBe(0);
  });
  it("telt invoegingen/vervangingen", () => {
    expect(levenshtein("genial", "génial")).toBe(1); // 1 accent verschil
    expect(levenshtein("ete", "été")).toBe(2); // twee accenten verschil
    expect(levenshtein("kat", "kaas")).toBe(2);
  });
});

describe("gradeAnswer", () => {
  it("exact juist is goed", () => {
    expect(gradeAnswer("maison", ["maison"], "frans")).toBe("goed");
  });

  it("frans: 1 ontbrekend accent telt als bijna", () => {
    expect(gradeAnswer("genial", ["génial"], "frans")).toBe("bijna");
  });

  it("frans: meerdere ontbrekende accenten is fout (strikt)", () => {
    expect(gradeAnswer("ete", ["été"], "frans")).toBe("fout");
  });

  it("frans: 2 tekens verschil is fout", () => {
    expect(gradeAnswer("maeson", ["maison"], "frans")).toBe("bijna"); // 1 vervanging
    expect(gradeAnswer("mason", ["maison"], "frans")).toBe("bijna"); // 1 verwijdering
    expect(gradeAnswer("mzson", ["maison"], "frans")).toBe("fout"); // 2 verschillen
  });

  it("engels: accent optioneel is goed, niet bijna", () => {
    expect(gradeAnswer("cafe", ["café"], "engels")).toBe("goed");
  });

  it("accepteert synoniemen uit acceptedAnswers", () => {
    expect(gradeAnswer("la maison", ["maison", "la maison"], "frans")).toBe("goed");
  });

  it("leeg antwoord is fout", () => {
    expect(gradeAnswer("   ", ["maison"], "frans")).toBe("fout");
  });

  it("exact-profiel geeft geen coulance", () => {
    expect(gradeAnswer("1788", ["1789"], "exact")).toBe("fout");
  });
});
