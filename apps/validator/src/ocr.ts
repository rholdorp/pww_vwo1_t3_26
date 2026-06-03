import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Onafhankelijke OCR-laag via macOS Vision (native/ocr.m, gecompileerd met clang).
 *
 * Bewust een ándere perceptie-technologie dan het LLM dat de trainer-content
 * extraheerde: Vision "leest" pixels met een eigen tekstherkenner en maakt dus
 * andere fouten dan een taalmodel. Dat maakt het een écht onafhankelijke
 * tweede waarnemer voor de coverage-check — en het draait volledig on-device,
 * zonder API-keys.
 */

const hierDir = dirname(fileURLToPath(import.meta.url));
const NATIVE_DIR = join(hierDir, "..", "native");
const BRON = join(NATIVE_DIR, "ocr.m");
const BINARY = join(NATIVE_DIR, "ocr");

interface OcrUitvoer {
  lines: string[];
}

let gebouwd = false;

/**
 * Zorg dat de native binary bestaat en up-to-date is t.o.v. de bron.
 * Compileert lazy met clang; gooit een duidelijke fout als dat niet lukt
 * (bv. op een niet-macOS host of zonder Command Line Tools).
 */
export function ensureOcrBinary(): void {
  if (gebouwd) return;
  const moetBouwen =
    !existsSync(BINARY) || statSync(BRON).mtimeMs > statSync(BINARY).mtimeMs;
  if (moetBouwen) {
    try {
      execFileSync(
        "clang",
        [
          "-framework", "Foundation",
          "-framework", "Vision",
          "-framework", "AppKit",
          "-fobjc-arc",
          "-O2",
          "-o", BINARY,
          BRON,
        ],
        { stdio: "pipe" },
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Kon de native OCR-binary niet compileren (clang). De onafhankelijke ` +
          `OCR-laag vereist macOS + Command Line Tools. Detail: ${detail}`,
      );
    }
  }
  gebouwd = true;
}

/** Herken tekstregels in één afbeelding via de native Vision-binary. */
export function ocrImage(imagePath: string): string[] {
  ensureOcrBinary();
  const stdout = execFileSync(BINARY, [imagePath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout) as OcrUitvoer;
  return parsed.lines;
}

/** Is de OCR-laag bruikbaar op deze host (macOS + clang + bron aanwezig)? */
export function ocrBeschikbaar(): boolean {
  if (process.platform !== "darwin") return false;
  if (!existsSync(BRON)) return false;
  try {
    ensureOcrBinary();
    return true;
  } catch {
    return false;
  }
}
