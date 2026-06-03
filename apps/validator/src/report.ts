import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CompareResult, Fact, FactPaar, Verdict } from "./types.js";
import type { CoverageResultaat } from "./coverage.js";

function factRegel(f: Fact): string {
  const bron = f.bron ? ` _(${f.bron})_` : "";
  return `- **${f.bronKey}** → ${f.bronValue}${bron}`;
}

function paarRegel(p: FactPaar): string {
  return `- **${p.trainer.bronKey}**: trainer \`${p.trainer.bronValue}\` ≠ screenshot \`${p.raw.bronValue}\``;
}

function coverageSectie(c: CoverageResultaat): string[] {
  const pct = c.beschouwdeRegels === 0 ? 0 : Math.round((c.gedekt / c.beschouwdeRegels) * 100);
  const lines = [
    "## 🔍 Onafhankelijke OCR-coverage (macOS Vision)",
    "",
    "Een tweede, onafhankelijke waarnemer (on-device OCR — andere technologie dan het",
    "extractie-LLM) leest de screenshots opnieuw. Elke gedrukte tekstregel hoort terug te",
    "komen in de trainer-content. Ongedekte regels zijn _mogelijk_ gemiste stof en vragen om",
    "menselijke review — koppen, paginanummers en uitleg horen hier ook bij.",
    "",
    `- screenshots ge-OCR'd: ${c.gescandeImages}`,
    `- beschouwde tekstregels: ${c.beschouwdeRegels}`,
    `- gedekt door trainer-content: ${c.gedekt} (${pct}%)`,
    `- ongedekt (review): ${c.ongedekt.length}`,
    "",
  ];
  if (c.ongedekt.length > 0) {
    lines.push("### Ongedekte regels — controleer of dit toetsbare stof is");
    for (const o of c.ongedekt) {
      const score = o.score.toFixed(2);
      const match = o.besteMatch ? ` _(dichtstbij: ${o.besteMatch} @ ${score})_` : "";
      lines.push(`- \`${o.regel}\` — ${o.bron}${match}`);
    }
    lines.push("");
  }
  return lines;
}

/** Render het validatierapport als markdown (SPEC §4 Stage 4 / §6). */
export function renderReport(
  v: Verdict,
  r: CompareResult,
  opts: { rawImages: number; coverage?: CoverageResultaat },
): string {
  const status = v.pass ? "✅ PASS" : "❌ FAIL";
  const lines: string[] = [
    `# Validatie — ${v.vak}`,
    "",
    `**Status:** ${status} · strengheid: ${v.strengheid} · gegenereerd ${new Date().toISOString()}`,
    "",
    "## Samenvatting",
    `- screenshots vergeleken: ${opts.rawImages}`,
    `- gekoppeld (correct): ${r.matched.length}`,
    `- missing (ontbreekt in trainer): ${r.missing.length}`,
    `- hallucinated (niet in screenshots): ${r.hallucinated.length}`,
    `- mismatch (andere waarde): ${r.mismatches.length}`,
    "",
  ];

  if (v.fouten.length > 0) {
    lines.push("## ❌ Blokkerende fouten", ...v.fouten.map((m) => `- ${m}`), "");
  }
  if (v.warnings.length > 0) {
    lines.push("## ⚠️ Waarschuwingen", ...v.warnings.map((m) => `- ${m}`), "");
  }
  if (r.missing.length > 0) {
    lines.push("## Missing — stof uit de screenshots die in de trainer ontbreekt", ...r.missing.map(factRegel), "");
  }
  if (r.hallucinated.length > 0) {
    lines.push("## Hallucinated — trainer-items zonder bron in de screenshots", ...r.hallucinated.map(factRegel), "");
  }
  if (r.mismatches.length > 0) {
    lines.push("## Mismatch — zelfde item, andere waarde", ...r.mismatches.map(paarRegel), "");
  }
  if (opts.coverage) {
    lines.push(...coverageSectie(opts.coverage));
  }

  return lines.join("\n");
}

/** Schrijf het rapport naar apps/validator/reports/<vak>-validation.md. Geeft het pad terug. */
export async function schrijfRapport(repoRoot: string, vak: string, inhoud: string): Promise<string> {
  const pad = join(repoRoot, "apps", "validator", "reports", `${vak}-validation.md`);
  await mkdir(dirname(pad), { recursive: true });
  await writeFile(pad, inhoud + "\n", "utf8");
  return pad;
}
