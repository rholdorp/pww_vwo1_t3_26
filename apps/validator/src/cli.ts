import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { VocabBestand } from "@pww/shared";
import type { CompareResult, Verdict } from "./types.js";
import { extractTrainerFacts } from "./facts.js";
import { compareFacts } from "./compare.js";
import { verdictCat1, verdictCat1Ocr } from "./verdict.js";
import { renderReport, schrijfRapport } from "./report.js";
import { AnthropicRawExtractor, gatherRawFacts, type RawExtractor } from "./rawExtractor.js";
import { gatherCoverage, type CoverageResultaat } from "./coverage.js";
import { ocrBeschikbaar } from "./ocr.js";

interface Args {
  vak: string;
  editie: string;
  extract: boolean;
}

function parseArgs(argv: string[]): Args {
  let vak = "";
  let editie = "2026-t3";
  let extract = false;
  for (const a of argv) {
    if (a.startsWith("--vak=")) vak = a.slice("--vak=".length);
    else if (a.startsWith("--editie=")) editie = a.slice("--editie=".length);
    else if (a === "--extract") extract = true;
  }
  return { vak, editie, extract };
}

async function main(): Promise<number> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const { vak, editie, extract } = parseArgs(process.argv.slice(2));

  if (!vak) {
    console.error("Gebruik: npm run validate -- --vak=<vak> [--editie=2026-t3] [--extract]");
    return 2;
  }

  const vocabPad = join(repoRoot, "content", editie, "trainers", vak, "vocab.json");
  if (!existsSync(vocabPad)) {
    console.error(`Geen trainer-content gevonden: ${vocabPad}`);
    return 2;
  }
  const bestand = JSON.parse(await readFile(vocabPad, "utf8")) as VocabBestand;
  const trainerFacts = extractTrainerFacts(bestand);

  let extractor: RawExtractor | undefined;
  if (extract) {
    const prompt = await readFile(join(repoRoot, "apps", "validator", "prompts", "extract-cat1.md"), "utf8");
    extractor = new AnthropicRawExtractor(prompt);
  }

  const { facts: rawFacts, ontbrekend, gebruikteImages } = await gatherRawFacts(
    repoRoot,
    editie,
    vak,
    extractor,
  );

  // PRIMAIRE, KEYLESS laag: onafhankelijke OCR-validatie (macOS Vision).
  let coverage: CoverageResultaat | undefined;
  if (ocrBeschikbaar()) {
    try {
      coverage = await gatherCoverage(repoRoot, editie, vak, trainerFacts);
    } catch (err) {
      console.error(`OCR-validatie overgeslagen: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.error("OCR-validatie niet beschikbaar op deze host (vereist macOS + clang).");
  }

  // OPTIONELE aanvulling: API-paar-diff. Voegt precieze mismatch-detectie toe die
  // de regel-gebaseerde OCR-laag niet kan; nooit vereist.
  const result: CompareResult =
    extract && gebruikteImages > 0
      ? compareFacts(trainerFacts, rawFacts)
      : { missing: [], hallucinated: [], mismatches: [], matched: [] };

  let verdict: Verdict;
  if (coverage) {
    verdict = verdictCat1Ocr(vak, coverage);
    if (extract && gebruikteImages > 0) {
      const pv = verdictCat1(vak, result);
      verdict.warnings.push(...pv.warnings);
      verdict.fouten.push(...pv.fouten.map((f) => `paar-diff: ${f}`));
      verdict.pass = verdict.pass && pv.pass;
    } else if (extract && ontbrekend.length > 0) {
      verdict.warnings.push(
        `${ontbrekend.length} screenshot(s) niet via de API geëxtraheerd (cache-miss / geen key) — OCR-laag dekt ze wel.`,
      );
    }
  } else if (extract && gebruikteImages > 0) {
    verdict = verdictCat1(vak, result);
  } else {
    verdict = {
      vak,
      strengheid: "strikt",
      pass: false,
      fouten: [
        `Geen onafhankelijke validatie beschikbaar voor ${vak}: OCR vereist macOS + clang, of draai met --extract (ANTHROPIC_API_KEY).`,
      ],
      warnings: [],
    };
  }

  const inhoud = renderReport(verdict, result, { rawImages: gebruikteImages, ...(coverage ? { coverage } : {}) });
  const rapportPad = await schrijfRapport(repoRoot, vak, inhoud);

  const status = verdict.pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${vak}`);
  for (const f of verdict.fouten) console.log(`  ✗ ${f}`);
  for (const w of verdict.warnings) console.log(`  ⚠ ${w}`);
  if (coverage) {
    console.log(
      `OCR-validatie: ${coverage.gegrond}/${coverage.trainerZijden} trainer-zijden gegrond, ` +
        `${coverage.gedekt}/${coverage.beschouwdeRegels} OCR-regels gedekt (${coverage.gescandeImages} screenshots).`,
    );
  }
  if (extract && gebruikteImages > 0) {
    console.log(
      `Paar-diff: matched ${result.matched.length}, missing ${result.missing.length}, hallucinated ${result.hallucinated.length}, mismatch ${result.mismatches.length}.`,
    );
  }
  console.log(`Rapport: ${rapportPad}`);

  return verdict.pass ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
