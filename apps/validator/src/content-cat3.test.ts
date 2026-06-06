import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  FlashcardBestand,
  OefenvraagBestand,
  NormalisatieProfiel,
} from "@pww/shared";

// Structurele guardrail voor het Cat 3-content-contract (flashcards.json /
// oefenvragen.json). Vervangt nog niet de fidelity-validatie (OCR-grounding van
// flashcards is een aparte validator-uitbreiding) — dit bewaakt alleen het schema
// + verwijzingen, zodat kapotte content niet ongemerkt landt.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const editieRoot = join(repoRoot, "content", "2026-t3");
const vakDir = join(editieRoot, "trainers", "aardrijkskunde");

const VALID_NORM: ReadonlySet<NormalisatieProfiel> = new Set([
  "frans",
  "engels",
  "begrip",
  "exact",
]);

const flashcards = JSON.parse(
  readFileSync(join(vakDir, "flashcards.json"), "utf8"),
) as FlashcardBestand;
const oefenvragen = JSON.parse(
  readFileSync(join(vakDir, "oefenvragen.json"), "utf8"),
) as OefenvraagBestand;

describe("aardrijkskunde flashcards.json", () => {
  it("heeft een geldig bestand-niveau normalisatieprofiel", () => {
    expect(VALID_NORM.has(flashcards.normalisatie)).toBe(true);
    expect(flashcards.vak).toBe("aardrijkskunde");
  });

  it("elke kaart heeft verplichte velden + geldige modus/normalisatie", () => {
    for (const k of flashcards.kaarten) {
      expect(k.id, `id van ${JSON.stringify(k)}`).toMatch(/^aardrijkskunde-h\d-/);
      expect(k.vraag.trim().length).toBeGreaterThan(0);
      expect(k.antwoord.trim().length).toBeGreaterThan(0);
      expect(k.hoofdstuk.length).toBeGreaterThan(0);
      expect(k.confidence).toBeGreaterThan(0);
      expect(k.confidence).toBeLessThanOrEqual(1);
      if (k.modus !== undefined) expect(["typen", "kaart"]).toContain(k.modus);
      if (k.normalisatie !== undefined) expect(VALID_NORM.has(k.normalisatie)).toBe(true);
    }
  });

  it("topografie-kaarten zijn flip-kaarten met een bestaande referentie-afbeelding", () => {
    const topo = flashcards.kaarten.filter((k) => k.onderdeel?.startsWith("topografie"));
    expect(topo.length).toBeGreaterThan(0);
    for (const k of topo) {
      expect(k.modus).toBe("kaart");
      expect(k.normalisatie).toBe("exact");
      expect(k.afbeelding, `afbeelding op ${k.id}`).toBeDefined();
      expect(existsSync(join(editieRoot, k.afbeelding!))).toBe(true);
    }
  });

  it("verwijst alleen naar bestaande raw-bronnen", () => {
    for (const k of flashcards.kaarten) {
      expect(existsSync(join(editieRoot, k.bron)), `bron ${k.bron}`).toBe(true);
    }
  });
});

describe("aardrijkskunde oefenvragen.json", () => {
  it("elke vraag heeft modelAntwoord + niet-lege rubric (SPEC §4)", () => {
    expect(oefenvragen.vragen.length).toBeGreaterThanOrEqual(3);
    for (const v of oefenvragen.vragen) {
      expect(v.id).toMatch(/^aardrijkskunde-h\d-/);
      expect(v.vraag.trim().length).toBeGreaterThan(0);
      expect(v.modelAntwoord.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(v.rubric)).toBe(true);
      expect(v.rubric.length).toBeGreaterThan(0);
      expect(existsSync(join(editieRoot, v.bron)), `bron ${v.bron}`).toBe(true);
    }
  });
});

describe("aardrijkskunde content — id-uniciteit over beide bestanden", () => {
  it("heeft geen dubbele id's", () => {
    const ids = [
      ...flashcards.kaarten.map((k) => k.id),
      ...oefenvragen.vragen.map((v) => v.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
