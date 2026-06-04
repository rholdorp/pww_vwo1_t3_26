/**
 * Stage 2 extract — wiskunde-variant (SPEC §4).
 *
 * Per screenshot draaien we TWEE prompts:
 *  1. extract-cat2-wiskunde.md → opgaven (vraag-tekst, opgavenummer, type)
 *  2. extract-cat1-wiskunde.md  → feiten (formule/begrip/eigenschap)
 *
 * Output cachen we per screenshot-fingerprint zoals rawExtractor (SPEC §4 idempotency).
 * Cache pad: content/<editie>/cache/extract-wiskunde/<sha>.json
 *
 * **POC-status:** prompts, parsers en types staan; multi-pass A+B en self-critique
 * (SPEC §4 Stage 2) zijn nog niet bedraad — alleen single-pass per prompt.
 */

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFeiten, parseOpgaven } from "./parse.js";
import type { ExtractCache, RawFeit, RawOpgave } from "./types.js";

export type { Cat1FeitType, Cat2OpgaveType, RawFeit, RawOpgave, ExtractCache } from "./types.js";
export { parseFeiten, parseOpgaven } from "./parse.js";

const DEFAULT_MODEL = "claude-opus-4-5-20250929";

export function fingerprint(inhoud: Buffer): string {
  return createHash("sha256").update(inhoud).digest("hex").slice(0, 16);
}

function cacheDir(repoRoot: string, editie: string): string {
  return join(repoRoot, "content", editie, "cache", "extract-wiskunde");
}

async function loadPromptFile(name: string): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "..", "..", "prompts", name);
  return readFile(path, "utf8");
}

interface ExtractResult {
  opgaven: RawOpgave[];
  feiten: RawFeit[];
}

/**
 * Roep Claude aan met de gegeven system-prompt + image. Returnt de tekstrespons.
 * Returnt null als de SDK/key ontbreekt — caller handelt af.
 */
async function callAnthropic(prompt: string, imagePath: string, model: string): Promise<string | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;
  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    Anthropic = (await import("@anthropic-ai/sdk")).default;
  } catch {
    return null;
  }
  const client = new Anthropic({ apiKey });
  const buffer = await readFile(imagePath);
  const base64 = buffer.toString("base64");
  const resp = await client.messages.create({
    model,
    max_tokens: 4096,
    system: prompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64 },
          },
          { type: "text", text: "Extraheer volgens de instructies." },
        ],
      },
    ],
  });
  const text = resp.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

export interface ExtractPaginaOpts {
  /** Pad naar de screenshot. */
  imagePath: string;
  /** Editie (voor cache-pad). */
  editie: string;
  /** Repository root (voor cache-pad). */
  repoRoot: string;
  /** Override model. */
  model?: string;
  /** Skip cache (re-extract). */
  noCache?: boolean;
}

/**
 * Extract opgaven + feiten van één pagina. Cache hit → directe return. Cache miss
 * en geen API-key → throws (caller moet --extract opt-in geven).
 */
export async function extractPagina(opts: ExtractPaginaOpts): Promise<ExtractResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const buffer = await readFile(opts.imagePath);
  const sha = fingerprint(buffer);
  const cachePath = join(cacheDir(opts.repoRoot, opts.editie), `${sha}.json`);
  const bron = relative(opts.repoRoot, opts.imagePath);

  if (!opts.noCache && existsSync(cachePath)) {
    const cached = JSON.parse(await readFile(cachePath, "utf8")) as ExtractCache;
    return { opgaven: cached.opgaven, feiten: cached.feiten };
  }

  const [cat2Prompt, cat1Prompt] = await Promise.all([
    loadPromptFile("extract-cat2-wiskunde.md"),
    loadPromptFile("extract-cat1-wiskunde.md"),
  ]);

  const [cat2Text, cat1Text] = await Promise.all([
    callAnthropic(cat2Prompt, opts.imagePath, model),
    callAnthropic(cat1Prompt, opts.imagePath, model),
  ]);

  if (cat2Text === null || cat1Text === null) {
    throw new Error(
      `Cache miss voor ${bron} maar ANTHROPIC_API_KEY of SDK ontbreekt — kan niet extracten.`
    );
  }

  const result: ExtractResult = {
    opgaven: parseOpgaven(cat2Text),
    feiten: parseFeiten(cat1Text),
  };

  const cache: ExtractCache = {
    image: bron,
    sha,
    model,
    extractedAt: new Date().toISOString(),
    opgaven: result.opgaven,
    feiten: result.feiten,
  };
  await mkdir(cacheDir(opts.repoRoot, opts.editie), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");

  return result;
}
