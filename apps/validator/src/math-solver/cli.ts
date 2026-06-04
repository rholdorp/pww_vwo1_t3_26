#!/usr/bin/env node
/**
 * CLI: npm run solve-math -- --demo
 *   Draait de POC-fixtures (handmatig geformuleerde opgaven) door beide solvers
 *   en print een review-rapport per tier.
 *
 * Latere uitbreiding (Stage 2 extract klaar): npm run solve-math -- --vak=wiskunde
 *   Leest geëxtraheerde opgaven uit content/<editie>/cache/extract/wiskunde/,
 *   schrijft resultaten naar content/<editie>/trainers/wiskunde/verified-answers.json,
 *   plus reports/wiskunde-review-needed.md voor LOW-confidence opgaven.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { POC_FIXTURES, solveBatch, type SolveResult } from "./index.js";

interface Args {
  demo: boolean;
  vak: string;
  editie: string;
}

function parseArgs(argv: string[]): Args {
  let demo = false;
  let vak = "";
  let editie = "2026-t3";
  for (const a of argv) {
    if (a === "--demo") demo = true;
    else if (a.startsWith("--vak=")) vak = a.slice("--vak=".length);
    else if (a.startsWith("--editie=")) editie = a.slice("--editie=".length);
  }
  return { demo, vak, editie };
}

function formatReport(results: SolveResult[]): string {
  const high = results.filter((r) => r.tier === "HIGH");
  const medium = results.filter((r) => r.tier === "MEDIUM");
  const low = results.filter((r) => r.tier === "LOW");

  const lines: string[] = [];
  lines.push("# Math-solver POC rapport");
  lines.push("");
  lines.push(`Total: ${results.length} | HIGH: ${high.length} | MEDIUM: ${medium.length} | LOW: ${low.length}`);
  lines.push("");

  for (const tier of [
    { naam: "HIGH (auto-approve)", items: high },
    { naam: "MEDIUM (auto-approve + note)", items: medium },
    { naam: "LOW (review nodig)", items: low },
  ]) {
    if (tier.items.length === 0) continue;
    lines.push(`## ${tier.naam}`);
    lines.push("");
    for (const r of tier.items) {
      lines.push(`### ${r.opgaveId}`);
      lines.push(`- antwoord: \`${r.answer ?? "(geen)"}\``);
      lines.push(`- confidence: ${r.confidence.toFixed(2)}`);
      lines.push(`- reden: ${r.reason}`);
      lines.push("- pogingen:");
      for (const a of r.attempts) {
        lines.push(
          `  - **${a.solver}**: \`${a.rawAnswer || "(leeg)"}\` (conf ${a.confidence.toFixed(2)}${a.unparseable ? ", unparseable" : ""})`
        );
        if (a.notes) lines.push(`    *${a.notes}*`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.demo && !args.vak) {
    console.error("Gebruik: solve-math --demo | --vak=<vak> [--editie=2026-t3]");
    return 2;
  }

  const opgaven = args.demo ? POC_FIXTURES : [];
  if (!args.demo) {
    console.error("Lazy mode (--vak): nog niet geïmplementeerd (Stage 2 extract moet eerst klaar zijn)");
    return 2;
  }

  console.error(`Solven ${opgaven.length} opgaven via solver A + B...`);
  const results = await solveBatch(opgaven);
  const rapport = formatReport(results);

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  const out = join(repoRoot, "apps", "validator", "reports", "math-solver-poc.md");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, rapport, "utf8");
  console.error(`Rapport geschreven: ${out}`);

  const lowCount = results.filter((r) => r.tier === "LOW").length;
  return lowCount > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
