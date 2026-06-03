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
  const dekPct = c.beschouwdeRegels === 0 ? 0 : Math.round((c.gedekt / c.beschouwdeRegels) * 100);
  const grondPct = c.trainerZijden === 0 ? 0 : Math.round((c.gegrond / c.trainerZijden) * 100);
  const lines = [
    "## 🔍 Onafhankelijke OCR-validatie (macOS Vision, keyless)",
    "",
    "Een onafhankelijke tweede waarnemer (on-device OCR — andere technologie dan een",
    "taalmodel) leest dezelfde screenshots en valideert bidirectioneel op regel-/zijde-niveau:",
    "",
    "- **ongegrond** (FAIL): trainer-zijde niet terug te vinden in de screenshots — de trainer",
    "  beweert iets zonder zichtbare bron (hallucinated).",
    "- **ongedekt** (review): gedrukte OCR-regel niet in de trainer — _mogelijk_ gemiste stof,",
    "  maar ruis-gevoelig (koppen, paginanummers, handschrift).",
    "",
    `- screenshots ge-OCR'd: ${c.gescandeImages}`,
    `- trainer-zijden gegrond: ${c.gegrond}/${c.trainerZijden} (${grondPct}%) — ongegrond: ${c.ongegrond.length}`,
    `- OCR-regels gedekt: ${c.gedekt}/${c.beschouwdeRegels} (${dekPct}%) — ongedekt: ${c.ongedekt.length}`,
    "",
  ];
  if (c.ongegrond.length > 0) {
    lines.push("### ❌ Ongegrond — trainer-tekst zonder bron in de screenshots");
    for (const o of c.ongegrond) {
      const id = o.id ? `${o.id} · ` : "";
      const match = o.besteMatch ? ` _(dichtstbij: ${o.besteMatch} @ ${o.score.toFixed(2)})_` : "";
      lines.push(`- ${id}${o.zijde}: \`${o.tekst}\`${match}`);
    }
    lines.push("");
  }
  if (c.ongedekt.length > 0) {
    lines.push("### Ongedekte regels — controleer of dit toetsbare stof is");
    for (const o of c.ongedekt) {
      const match = o.besteMatch ? ` _(dichtstbij: ${o.besteMatch} @ ${o.score.toFixed(2)})_` : "";
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
  ];
  if (opts.coverage) {
    const c = opts.coverage;
    lines.push(
      `- OCR-validatie (keyless): ${c.gegrond}/${c.trainerZijden} trainer-zijden gegrond, ` +
        `${c.ongegrond.length} ongegrond, ${c.ongedekt.length} OCR-regels ter review`,
    );
  }
  if (opts.rawImages > 0) {
    lines.push(
      `- API-paar-diff: ${opts.rawImages} screenshots · matched ${r.matched.length}, ` +
        `missing ${r.missing.length}, hallucinated ${r.hallucinated.length}, mismatch ${r.mismatches.length}`,
    );
  } else {
    lines.push("- API-paar-diff: niet gedraaid (geen --extract)");
  }
  lines.push("");

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
