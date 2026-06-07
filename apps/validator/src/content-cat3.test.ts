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

// Vakken met een Cat 3-extractie (flashcards + oefenvragen).
const CAT3_VAKKEN = ["aardrijkskunde", "geschiedenis"];

const VALID_NORM: ReadonlySet<NormalisatieProfiel> = new Set([
  "frans",
  "engels",
  "begrip",
  "exact",
]);

function laad<T>(vak: string, bestand: string): T {
  return JSON.parse(
    readFileSync(join(editieRoot, "trainers", vak, bestand), "utf8"),
  ) as T;
}

for (const vak of CAT3_VAKKEN) {
  const flashcards = laad<FlashcardBestand>(vak, "flashcards.json");
  const oefenvragen = laad<OefenvraagBestand>(vak, "oefenvragen.json");
  // Ids zijn vak-namespaced; het oude `-h\d`-patroon klopt niet meer sinds we ook
  // vaardigheid-/thema-gebaseerde ids hebben (bv. geschiedenis-vaard-…, biologie-t4-…).
  const idRe = new RegExp(`^${vak}-\\S`);

  describe(`${vak} flashcards.json`, () => {
    it("heeft een geldig bestand-niveau normalisatieprofiel + juiste vak", () => {
      expect(VALID_NORM.has(flashcards.normalisatie)).toBe(true);
      expect(flashcards.vak).toBe(vak);
    });

    it("elke kaart heeft verplichte velden + geldige modus/normalisatie", () => {
      for (const k of flashcards.kaarten) {
        expect(k.id, `id van ${JSON.stringify(k)}`).toMatch(idRe);
        expect(k.vraag.trim().length).toBeGreaterThan(0);
        expect(k.antwoord.trim().length).toBeGreaterThan(0);
        expect(k.hoofdstuk.length).toBeGreaterThan(0);
        expect(k.confidence).toBeGreaterThan(0);
        expect(k.confidence).toBeLessThanOrEqual(1);
        if (k.modus !== undefined) expect(["typen", "kaart"]).toContain(k.modus);
        if (k.normalisatie !== undefined) expect(VALID_NORM.has(k.normalisatie)).toBe(true);
      }
    });

    it("kaart-modus 'kaart' heeft exact-normalisatie + bestaande referentie-afbeelding", () => {
      const kaartModus = flashcards.kaarten.filter((k) => k.modus === "kaart");
      for (const k of kaartModus) {
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

  describe(`${vak} oefenvragen.json`, () => {
    it("elke vraag heeft modelAntwoord + niet-lege rubric (SPEC §4)", () => {
      expect(oefenvragen.vragen.length).toBeGreaterThanOrEqual(3);
      for (const v of oefenvragen.vragen) {
        expect(v.id).toMatch(idRe);
        expect(v.vraag.trim().length).toBeGreaterThan(0);
        expect(v.modelAntwoord.trim().length).toBeGreaterThan(0);
        expect(Array.isArray(v.rubric)).toBe(true);
        expect(v.rubric.length).toBeGreaterThan(0);
        expect(existsSync(join(editieRoot, v.bron)), `bron ${v.bron}`).toBe(true);
      }
    });
  });

  describe(`${vak} content — id-uniciteit over beide bestanden`, () => {
    it("heeft geen dubbele id's", () => {
      const ids = [
        ...flashcards.kaarten.map((k) => k.id),
        ...oefenvragen.vragen.map((v) => v.id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
}
