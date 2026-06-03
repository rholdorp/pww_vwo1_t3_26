import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { VocabBestand } from "@pww/shared";
import type { CompareResult, Verdict } from "./types.js";
import { extractTrainerFacts } from "./facts.js";
import { compareFacts } from "./compare.js";
import { verdictCat1 } from "./verdict.js";
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

  // Onafhankelijke OCR-coverage (macOS Vision, geen keys). Draait altijd als de
  // host het ondersteunt — los van de API-gebaseerde paar-extractie hierboven.
  let coverage: CoverageResultaat | undefined;
  if (ocrBeschikbaar()) {
    try {
      coverage = await gatherCoverage(repoRoot, editie, vak, trainerFacts);
    } catch (err) {
      console.error(`OCR-coverage overgeslagen: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.error("OCR-coverage niet beschikbaar op deze host (vereist macOS + clang).");
  }

  // P8: zonder onafhankelijke extractie van álle screenshots kan completeness niet worden
  // gegarandeerd → blokkeer en wees er eerlijk over. Zonder enige raw-extractie is de diff
  // betekenisloos (alles zou "hallucinated" lijken), dus die slaan we dan over.
  let result: CompareResult;
  let verdict: Verdict;
  if (gebruikteImages === 0) {
    result = { missing: [], hallucinated: [], mismatches: [], matched: [] };
    verdict = {
      vak,
      strengheid: "strikt",
      pass: false,
      fouten: [
        `Geen onafhankelijke raw-extractie beschikbaar voor ${vak}. Draai met --extract (vereist ANTHROPIC_API_KEY).`,
      ],
      warnings: [],
    };
  } else {
    result = compareFacts(trainerFacts, rawFacts);
    verdict = verdictCat1(vak, result);
    if (ontbrekend.length > 0) {
      verdict.pass = false;
      verdict.fouten.unshift(
        `${ontbrekend.length} screenshot(s) niet onafhankelijk geëxtraheerd: ${ontbrekend.join(", ")}. Draai met --extract.`,
      );
    }
  }

  if (coverage && coverage.ongedekt.length > 0) {
    verdict.warnings.push(
      `OCR-coverage: ${coverage.ongedekt.length} regel(s) niet teruggevonden in de trainer — ` +
        `controleer in het rapport of dit toetsbare stof is.`,
    );
  }

  const inhoud = renderReport(verdict, result, { rawImages: gebruikteImages, ...(coverage ? { coverage } : {}) });
  const rapportPad = await schrijfRapport(repoRoot, vak, inhoud);

  const status = verdict.pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${vak} — matched ${result.matched.length}, missing ${result.missing.length}, hallucinated ${result.hallucinated.length}, mismatch ${result.mismatches.length}`);
  for (const f of verdict.fouten) console.log(`  ✗ ${f}`);
  for (const w of verdict.warnings) console.log(`  ⚠ ${w}`);
  if (coverage) {
    console.log(
      `OCR-coverage: ${coverage.gedekt}/${coverage.beschouwdeRegels} regels gedekt, ${coverage.ongedekt.length} ter review (${coverage.gescandeImages} screenshots).`,
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
