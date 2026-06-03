import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { Fact } from "./types.js";
import { normKey, normValue } from "./normalize.js";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/** Een woordpaar zoals onafhankelijk uit een screenshot gehaald (vóór normalisatie). */
export interface RawPaar {
  nl: string;
  vreemd: string;
}

interface CacheBestand {
  image: string;
  sha: string;
  model: string;
  extractedAt: string;
  pairs: RawPaar[];
}

/** Een bron die woordparen onafhankelijk uit een screenshot haalt (vision-model). */
export interface RawExtractor {
  readonly model: string;
  extract(imagePath: string): Promise<RawPaar[]>;
}

export function fingerprint(inhoud: Buffer): string {
  return createHash("sha256").update(inhoud).digest("hex").slice(0, 16);
}

function cacheDir(repoRoot: string, editie: string, vak: string): string {
  return join(repoRoot, "content", editie, "cache", "raw-facts", vak);
}

/** Lijst alle screenshot-paden voor een vak. */
export async function listRawImages(repoRoot: string, editie: string, vak: string): Promise<string[]> {
  const dir = join(repoRoot, "content", editie, "raw", vak);
  if (!existsSync(dir)) return [];
  const namen = await readdir(dir);
  return namen
    .filter((n) => IMAGE_EXTS.has(extname(n).toLowerCase()))
    .map((n) => join(dir, n))
    .sort();
}

function paarNaarFact(p: RawPaar, bron: string): Fact {
  return { key: normKey(p.nl), value: normValue(p.vreemd), bronKey: p.nl, bronValue: p.vreemd, bron };
}

/**
 * Verzamel raw-facts voor een vak. Per screenshot: gebruik de fingerprint-cache (SPEC §4);
 * bij een cache-miss extraheer alleen als er een extractor is. Screenshots zonder cache én
 * zonder extractor komen in `ontbrekend` — die mogen NIET stil worden overgeslagen, want dan
 * zou de validator gemiste stof kunnen missen (P8).
 */
export async function gatherRawFacts(
  repoRoot: string,
  editie: string,
  vak: string,
  extractor?: RawExtractor,
): Promise<{ facts: Fact[]; ontbrekend: string[]; gebruikteImages: number }> {
  const images = await listRawImages(repoRoot, editie, vak);
  const facts: Fact[] = [];
  const ontbrekend: string[] = [];
  let gebruikteImages = 0;

  for (const imagePath of images) {
    const inhoud = await readFile(imagePath);
    const sha = fingerprint(inhoud);
    const cachePath = join(cacheDir(repoRoot, editie, vak), `${sha}.json`);
    const bron = relative(repoRoot, imagePath);

    let pairs: RawPaar[] | null = null;
    if (existsSync(cachePath)) {
      const cache = JSON.parse(await readFile(cachePath, "utf8")) as CacheBestand;
      pairs = cache.pairs;
    } else if (extractor) {
      pairs = await extractor.extract(imagePath);
      const cache: CacheBestand = {
        image: bron,
        sha,
        model: extractor.model,
        extractedAt: new Date().toISOString(),
        pairs,
      };
      await mkdir(cacheDir(repoRoot, editie, vak), { recursive: true });
      await writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
    }

    if (pairs === null) {
      ontbrekend.push(bron);
      continue;
    }
    gebruikteImages++;
    for (const p of pairs) facts.push(paarNaarFact(p, bron));
  }

  return { facts, ontbrekend, gebruikteImages };
}

/** Vision-extractor op basis van de Anthropic API. Lazy import: alleen nodig bij cache-miss. */
export class AnthropicRawExtractor implements RawExtractor {
  readonly model: string;
  private readonly prompt: string;

  constructor(prompt: string, model = "claude-opus-4-7") {
    this.prompt = prompt;
    this.model = model;
  }

  async extract(imagePath: string): Promise<RawPaar[]> {
    if (!process.env["ANTHROPIC_API_KEY"]) {
      throw new Error("ANTHROPIC_API_KEY ontbreekt — kan screenshots niet onafhankelijk extraheren.");
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const data = await readFile(imagePath);
    const mediaType = extname(imagePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

    const resp = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: data.toString("base64") } },
            { type: "text", text: this.prompt },
          ],
        },
      ],
    });

    const tekst = resp.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseParen(tekst, basename(imagePath));
  }
}

/** Haal het JSON-array met woordparen uit een (mogelijk in tekst verpakt) modelantwoord. */
export function parseParen(tekst: string, context: string): RawPaar[] {
  const start = tekst.indexOf("[");
  const eind = tekst.lastIndexOf("]");
  if (start === -1 || eind === -1 || eind < start) {
    throw new Error(`Geen JSON-array gevonden in extractie van ${context}.`);
  }
  const parsed = JSON.parse(tekst.slice(start, eind + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`Extractie van ${context} is geen array.`);
  return parsed
    .filter((p): p is RawPaar => typeof p === "object" && p !== null && "nl" in p && "vreemd" in p)
    .map((p) => ({ nl: String(p.nl), vreemd: String(p.vreemd) }));
}
