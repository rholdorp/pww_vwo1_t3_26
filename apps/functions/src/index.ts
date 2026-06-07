// Firebase Cloud Functions — Cat 4 schrijf-feedback proxy.
//
// Productie-equivalent van apps/web/server/schrijfFeedback.ts (Vite dev-
// middleware). De Anthropic API-sleutel staat in een Cloud secret en komt nooit
// in de client-bundle. Identieke request/response-shape als dev-endpoint, zodat
// de client alleen de URL hoeft te wisselen (zie VITE_FUNCTIONS_BASE_URL).
//
// Region: europe-west1 (Belgium). Past bij Stijn (NL).

import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

setGlobalOptions({
  region: "europe-west1",
  maxInstances: 5,
});

const MODEL = "claude-haiku-4-5"; // Haiku-tier (kosten-efficiënt)

const SYSTEM = `Je bent een vriendelijke, bemoedigende docent Nederlands die het werk van een brugklasser (klas 1, ±12 jaar) begeleidt.
De leerling oefent met het schrijven van een INFORMELE BRIEF aan de hoofdpersoon uit een gegeven tekstfragment (dit is de PWW-toetsvaardigheid).
Beoordeel/geef feedback in eenvoudig, bemoedigend Nederlands op brugklas-niveau. Spreek de leerling direct aan met "je".
Let bij een informele brief op: een passende informele aanhef; een persoonlijke, informele toon; dat de leerling reageert op het fragment en zich inleeft in de hoofdpersoon; eigen inbreng; een logische opbouw (begin–midden–eind); een nette afsluiting met groet; en spelling/zinsbouw.
Wees concreet en positief: noem eerst wat goed gaat en daarna wat beter kan. Verzin geen feiten over de leerling.`;

interface FeedbackBody {
  mode?: string;
  opdracht?: string;
  tekstfragment?: string;
  brief?: string;
}

function userPrompt(mode: string, b: FeedbackBody): string {
  const basis =
    `OPDRACHT:\n${b.opdracht ?? ""}\n\n` +
    `TEKSTFRAGMENT:\n${b.tekstfragment ?? ""}\n\n` +
    `BRIEF VAN DE LEERLING:\n${(b.brief ?? "").trim() || "(nog niets geschreven)"}\n\n`;
  if (mode === "score") {
    return (
      basis +
      `Geef een EINDBEOORDELING. Antwoord UITSLUITEND met JSON in dit formaat: ` +
      `{"score": <heel getal 0 t/m 10>, "samenvatting": "<1-2 zinnen>", ` +
      `"sterk": ["<sterk punt>", ...], "verbeterpunten": ["<concreet verbeterpunt>", ...]}.`
    );
  }
  return (
    basis +
    `Geef OPBOUWENDE FEEDBACK (nog GEEN cijfer). Noem 2 à 3 dingen die goed gaan en 2 à 3 concrete verbeterpunten. ` +
    `Kort en vriendelijk, in een paar zinnen of bullets, direct tegen de leerling ("je").`
  );
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "cijfer 0 t/m 10" },
    samenvatting: { type: "string" },
    sterk: { type: "array", items: { type: "string" } },
    verbeterpunten: { type: "array", items: { type: "string" } },
  },
  required: ["score", "samenvatting", "sterk", "verbeterpunten"],
  additionalProperties: false,
};

function tekstUit(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
}

function parseScore(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* val door */
      }
    }
    return { score: null, samenvatting: raw.slice(0, 400), sterk: [], verbeterpunten: [] };
  }
}

async function handle(apiKey: string, body: FeedbackBody): Promise<unknown> {
  const client = new Anthropic({ apiKey });
  const mode = body.mode === "score" ? "score" : "feedback";
  const system = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
  const params: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userPrompt(mode, body) }],
  };
  if (mode === "score") {
    params.output_config = { format: { type: "json_schema", schema: SCORE_SCHEMA } };
  }
  const resp = await (client.messages.create as unknown as (p: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }>)(params);
  const text = tekstUit(resp.content);
  return mode === "score" ? parseScore(text) : { feedback: text };
}

export const schrijfFeedback = onRequest(
  {
    cors: true, // GitHub Pages → Cloud Functions cross-origin
    invoker: "public", // browser-visitor mag direct callen (Firebase v2 = private by default)
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method" });
      return;
    }
    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      res.status(503).json({
        error: "no-key",
        message: "ANTHROPIC_API_KEY-secret ontbreekt op de Cloud Function.",
      });
      return;
    }
    try {
      const body = (req.body ?? {}) as FeedbackBody;
      const result = await handle(apiKey, body);
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({
        error: "server",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
);
