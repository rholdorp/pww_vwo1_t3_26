/**
 * Solver-runner: roept Claude aan met één van de twee solver-prompts en
 * parseert de JSON-respons naar een SolveAttempt.
 *
 * Vereist `@anthropic-ai/sdk` (optionalDep) + `ANTHROPIC_API_KEY` env-var.
 * Zonder beide kan de runner niet draaien; canonical/verdict tests werken wel.
 *
 * Het Code Execution tool is een beta-feature; de SDK-aanroep gebruikt
 * `tools: [{ type: "code_execution_20250522", name: "code_execution" }]` zoals
 * gedocumenteerd in de Claude API docs voor wiskundige problemen.
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize } from "./canonical.js";
import type { Opgave, SolveAttempt } from "./types.js";

interface RunnerOpts {
  /** Welke prompt — bepaalt prompts/solve-math-{a,b}.md */
  solver: "A" | "B";
  /** Override model (default: claude-opus-4 of vergelijkbaar). */
  model?: string;
  /** Max turns met code-execution (default: 5). */
  maxTurns?: number;
}

const DEFAULT_MODEL = "claude-opus-4-5-20250929";

async function loadPrompt(solver: "A" | "B"): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const promptPad = resolve(here, "..", "..", "prompts", `solve-math-${solver.toLowerCase()}.md`);
  return readFile(promptPad, "utf8");
}

/**
 * Roep Claude aan om de opgave op te lossen. Retourneert null als de SDK of
 * API-sleutel ontbreekt — de caller moet dan de POC in mock-mode draaien.
 */
export async function runSolver(opgave: Opgave, opts: RunnerOpts): Promise<SolveAttempt | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[math-solver] geen ANTHROPIC_API_KEY in env — runner skippt");
    return null;
  }

  // Late dynamic import zodat tests werken zonder SDK installed.
  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    Anthropic = (await import("@anthropic-ai/sdk")).default;
  } catch {
    console.error("[math-solver] @anthropic-ai/sdk niet geïnstalleerd");
    return null;
  }

  const client = new Anthropic({ apiKey });
  const prompt = await loadPrompt(opts.solver);
  const model = opts.model ?? DEFAULT_MODEL;

  const opgaveTekst = formatOpgaveVoorPrompt(opgave);

  // NB: code_execution is een beta; specifiek tool-type-id zoals in de docs.
  // Code Execution tool is een beta op een tijdvenster: extra header nodig.
  // We zetten de header per-call mee zodat de SDK-typing dezelfde blijft.
  const resp = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      system: prompt,
      // biome-ignore lint/suspicious/noExplicitAny: tools-type voor beta features
      tools: [{ type: "code_execution_20250522", name: "code_execution" } as any],
      messages: [{ role: "user", content: opgaveTekst }],
    },
    {
      headers: { "anthropic-beta": "code-execution-2025-05-22" },
    }
  );

  // De laatste text-block bevat de JSON-respons per onze prompt-instructie.
  const tekstBlocks = resp.content.filter(
    (b): b is { type: "text"; text: string } => b.type === "text"
  );
  const laatste = tekstBlocks[tekstBlocks.length - 1]?.text ?? "";
  return parseJsonAntwoord(laatste, opts.solver);
}

function formatOpgaveVoorPrompt(opgave: Opgave): string {
  const ctx = opgave.context;
  const ctxLine = ctx
    ? `Context: ${ctx.paragraaf ?? ""}${ctx.opgavenummer ? ` opgave ${ctx.opgavenummer}` : ""}`
    : "";
  return [`Opgave id: ${opgave.id}`, ctxLine, "", "Vraag:", opgave.vraag].filter(Boolean).join("\n");
}

function parseJsonAntwoord(rawText: string, solver: "A" | "B"): SolveAttempt | null {
  // Extract JSON-blok (tussen ```...``` of als kale JSON).
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)```/);
  const json = (fenceMatch?.[1] ?? rawText).trim();
  const jsonStart = json.indexOf("{");
  if (jsonStart < 0) return null;
  try {
    const parsed = JSON.parse(json.slice(jsonStart)) as {
      answer?: string;
      confidence?: number;
      unparseable?: boolean;
      explanation?: string;
      method?: string;
    };
    const rawAnswer = parsed.answer ?? "";
    const notes = parsed.explanation ?? parsed.method;
    const att: SolveAttempt = {
      solver,
      rawAnswer,
      canonical: canonicalize(rawAnswer),
      confidence: typeof parsed.confidence === "number" ? clamp01(parsed.confidence) : 0,
      unparseable: parsed.unparseable === true,
    };
    if (notes !== undefined) att.notes = notes;
    return att;
  } catch (e) {
    console.error("[math-solver] JSON parse-fout in solver-respons", (e as Error).message);
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
