import { describe, expect, it } from "vitest";
import type { VocabItem } from "@pww/shared";
import { bouwKaart } from "./kaart.js";
import { gradeAnswer } from "./normalize.js";

const belle: VocabItem = {
  id: "frans-h5-woord-114",
  nl: "mooi",
  vreemd: "belle",
  vorm: "vrouwelijk",
  hoofdstuk: "5",
  bron: "raw/frans/x.jpeg",
  confidence: 0.9,
};

const kaas: VocabItem = {
  id: "frans-h5-woord-001",
  nl: "de kaas",
  vreemd: "le fromage",
  hoofdstuk: "5",
  bron: "raw/frans/x.jpeg",
  confidence: 0.95,
};

describe("bouwKaart", () => {
  it("nl->vreemd toont het vorm-label en accepteert de vreemde vorm", () => {
    const k = bouwKaart(belle, "nl->vreemd");
    expect(k.prompt).toBe("mooi (vrouwelijk)");
    expect(k.accepted).toEqual(["belle"]);
    expect(gradeAnswer("belle", k.accepted, "frans")).toBe("goed");
  });

  it("vreemd->nl vraagt de vreemde vorm en accepteert de KALE NL-betekenis", () => {
    const k = bouwKaart(belle, "vreemd->nl");
    expect(k.prompt).toBe("belle");
    // Stijn typt "mooi", niet "mooi (vrouwelijk)".
    expect(gradeAnswer("mooi", k.accepted, "frans")).toBe("goed");
    expect(gradeAnswer("mooi (vrouwelijk)", k.accepted, "frans")).toBe("fout");
  });

  it("voegt acceptedAnswers toe in de nl->vreemd richting", () => {
    const item: VocabItem = { ...belle, acceptedAnswers: ["belle ", "Belle"] };
    const k = bouwKaart(item, "nl->vreemd");
    expect(k.accepted).toEqual(["belle", "belle ", "Belle"]);
  });

  it("laat de prompt ongemoeid als er geen vorm-label is", () => {
    expect(bouwKaart(kaas, "nl->vreemd").prompt).toBe("de kaas");
    expect(bouwKaart(kaas, "vreemd->nl").prompt).toBe("le fromage");
  });
});
