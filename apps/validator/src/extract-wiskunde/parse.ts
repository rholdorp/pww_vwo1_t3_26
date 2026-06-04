/**
 * JSON-respons-parsers voor de twee wiskunde extract-prompts.
 *
 * Robuust voor:
 *  - JSON-array binnen ```fenced``` block
 *  - JSON-array als bare tekst
 *  - Onverwachte velden (worden gefilterd)
 *  - Niet-array antwoorden (returnen lege lijst i.p.v. crashen)
 */

import type { Cat1FeitType, Cat2OpgaveType, RawFeit, RawOpgave } from "./types.js";

const CAT2_TYPES: ReadonlySet<Cat2OpgaveType> = new Set<Cat2OpgaveType>([
  "berekening",
  "herleiden",
  "oplossen-vergelijking",
  "wetenschappelijke-notatie",
  "meetkunde",
  "open-vraag",
  "anders",
]);

const CAT1_TYPES: ReadonlySet<Cat1FeitType> = new Set<Cat1FeitType>([
  "formule",
  "begrip",
  "eigenschap",
]);

function unwrapJsonArray(rawText: string): unknown {
  // Strip fenced code block(s)
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)```/);
  const body = (fenceMatch?.[1] ?? rawText).trim();
  const arrayStart = body.indexOf("[");
  if (arrayStart < 0) return [];
  try {
    return JSON.parse(body.slice(arrayStart));
  } catch {
    return [];
  }
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function asNullableString(v: unknown): string | null {
  return isString(v) && v.length > 0 ? v : null;
}

export function parseOpgaven(rawText: string): RawOpgave[] {
  const raw = unwrapJsonArray(rawText);
  if (!Array.isArray(raw)) return [];
  const out: RawOpgave[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const opgavenummer = isString(o["opgavenummer"]) ? o["opgavenummer"] : null;
    const vraag = isString(o["vraag"]) ? o["vraag"] : null;
    if (!opgavenummer || !vraag) continue;
    const rawType = isString(o["type"]) ? o["type"] : "anders";
    const type: Cat2OpgaveType = CAT2_TYPES.has(rawType as Cat2OpgaveType)
      ? (rawType as Cat2OpgaveType)
      : "anders";
    out.push({
      opgavenummer,
      vraag,
      onderdeel: asNullableString(o["onderdeel"]),
      type,
      bijzonderheden: asNullableString(o["bijzonderheden"]),
    });
  }
  return out;
}

export function parseFeiten(rawText: string): RawFeit[] {
  const raw = unwrapJsonArray(rawText);
  if (!Array.isArray(raw)) return [];
  const out: RawFeit[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const rawType = isString(o["type"]) ? o["type"] : null;
    if (!rawType || !CAT1_TYPES.has(rawType as Cat1FeitType)) continue;
    const vraag = isString(o["vraag"]) ? o["vraag"] : null;
    const antwoord = isString(o["antwoord"]) ? o["antwoord"] : null;
    if (!vraag || !antwoord) continue;
    out.push({
      type: rawType as Cat1FeitType,
      vraag,
      antwoord,
      context: isString(o["context"]) ? o["context"] : "",
    });
  }
  return out;
}
