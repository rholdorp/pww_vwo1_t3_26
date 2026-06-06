import type { Plugin } from "vite";
import Anthropic from "@anthropic-ai/sdk";

// Cat 4 schrijf-feedback proxy. Draait SERVER-SIDE in de Vite dev-server: de
// ANTHROPIC_API_KEY blijft hier en komt nooit in de client-bundle (repo is publiek).
// Productie (GitHub Pages) heeft geen server → daar komt later de Cloud Function
// (SPEC §11, uitgesteld). Tot dan: lokaal via dit endpoint, met checklist-fallback.

const MODEL = "claude-haiku-4-5"; // Haiku-tier (kosten-efficiënt), op verzoek

const SYSTEM = `Je bent een vriendelijke, bemoedigende docent Nederlands die het werk van een brugklasser (klas 1, ±12 jaar) begeleidt.
De leerling oefent met het schrijven van een INFORMELE BRIEF aan de hoofdpersoon uit een gegeven tekstfragment (dit is de PWW-toetsvaardigheid).
Beoordeel/geef feedback in eenvoudig, bemoedigend Nederlands op brugklas-niveau. Spreek de leerling direct aan met "je".
Let bij een informele brief op: een passende informele aanhef; een persoonlijke, informele toon; dat de leerling reageert op het fragment en zich inleeft in de hoofdpersoon; eigen inbreng; een logische opbouw (begin–midden–eind); een nette afsluiting met groet; en spelling/zinsbouw.
Wees concreet en positief: noem eerst wat goed gaat en daarna wat beter kan. Verzin geen feiten over de leerling.`;

function userPrompt(mode: string, b: { opdracht?: string; tekstfragment?: string; brief?: string }): string {
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
  return content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
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

async function handle(apiKey: string, body: Record<string, unknown>): Promise<unknown> {
  const client = new Anthropic({ apiKey });
  const mode = body.mode === "score" ? "score" : "feedback";
  // Stabiele systeem-prefix met cache_control (prompt caching). Bij korte prefixes
  // (< ~4096 tokens) cachet de API niet, maar het is verder onschadelijk.
  const system = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
  const params: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userPrompt(mode, body as never) }],
  };
  if (mode === "score") {
    params.output_config = { format: { type: "json_schema", schema: SCORE_SCHEMA } };
  }
  // SDK 0.32 typt output_config niet; params worden as-is naar /v1/messages gestuurd.
  const resp = await (client.messages.create as unknown as (p: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }>)(params);
  const text = tekstUit(resp.content);
  return mode === "score" ? parseScore(text) : { feedback: text };
}

export function schrijfFeedbackPlugin(apiKey: string | undefined): Plugin {
  return {
    name: "pww-schrijf-feedback",
    configureServer(server) {
      server.middlewares.use("/api/schrijf-feedback", (req, res) => {
        const json = (code: number, obj: unknown) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(obj));
        };
        if (req.method !== "POST") return json(405, { error: "method" });
        if (!apiKey) {
          return json(503, {
            error: "no-key",
            message:
              "Geen ANTHROPIC_API_KEY in de dev-omgeving. Zet hem in apps/web/.env om live feedback te krijgen.",
          });
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            json(200, await handle(apiKey, body));
          } catch (e) {
            json(500, { error: "server", message: e instanceof Error ? e.message : String(e) });
          }
        });
      });
    },
  };
}
