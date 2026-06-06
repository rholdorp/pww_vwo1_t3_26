import type {
  VocabBestand,
  FlashcardBestand,
  OefenvraagBestand,
  NormalisatieProfiel,
  Richting,
} from "@pww/shared";
import { bouwKaart } from "@pww/trainer-engine";

// Alle trainer-content wordt bij build/dev meegebundeld (static, geen Firestore).
const jsonModules = import.meta.glob(
  "../../../content/2026-t3/trainers/**/*.json",
  { eager: true },
) as Record<string, { default: unknown }>;

// Alleen de mappen waaruit flashcards een referentie-afbeelding gebruiken (nu enkel
// aardrijkskunde-topografie). Bewust smal gehouden zodat de grote raw-scans van andere
// vakken niet mee de bundle in gaan. Breid uit als een vak beeld-flashcards toevoegt.
const imageUrls = import.meta.glob(
  "../../../content/2026-t3/raw/aardrijkskunde/*.{jpg,jpeg,png}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function vakFromPath(p: string): string {
  return p.match(/trainers\/([^/]+)\//)?.[1] ?? "onbekend";
}
function fileFromPath(p: string): string {
  return p.split("/").pop() ?? "";
}
function resolveImage(rel?: string): string | undefined {
  if (!rel) return undefined;
  const key = Object.keys(imageUrls).find((k) => k.endsWith(rel));
  return key ? imageUrls[key] : undefined;
}

/** Eén te oefenen kaart, klaar voor de UI. */
export type Card =
  | {
      kind: "typed";
      id: string;
      prompt: string;
      accepted: string[];
      norm: NormalisatieProfiel;
      answer: string;
      image?: string;
    }
  | {
      kind: "flip";
      id: string;
      front: string;
      back: string;
      rubric?: string[];
      image?: string;
    };

export type BlokSoort = "vocab" | "flashcards" | "oefenvragen";

export interface Blok {
  id: string;
  vak: string;
  titel: string;
  soort: BlokSoort;
  aantal: number;
  /** Vocab kent twee richtingen; andere blokken negeren de parameter. */
  richtingen?: Richting[];
  bouwCards: (richting?: Richting) => Card[];
}

export interface VakGroep {
  vak: string;
  blokken: Blok[];
}

const VAK_LABEL: Record<string, string> = {
  frans: "Frans",
  aardrijkskunde: "Aardrijkskunde",
  geschiedenis: "Geschiedenis",
  engels: "Engels",
  nederlands: "Nederlands",
  biologie: "Biologie",
  wiskunde: "Wiskunde",
};

export function vakLabel(vak: string): string {
  return VAK_LABEL[vak] ?? vak;
}

export function richtingLabel(vak: string, r: Richting): string {
  const vreemd = vakLabel(vak);
  return r === "nl->vreemd" ? `Nederlands → ${vreemd}` : `${vreemd} → Nederlands`;
}

function buildBlokken(): Blok[] {
  const blokken: Blok[] = [];
  for (const [path, mod] of Object.entries(jsonModules)) {
    const vak = vakFromPath(path);
    const file = fileFromPath(path);
    const data = mod.default;

    if (file === "vocab.json") {
      const b = data as VocabBestand;
      const richtingen = b.richtingen?.length ? b.richtingen : (["nl->vreemd"] as Richting[]);
      blokken.push({
        id: `${vak}/vocab`,
        vak,
        soort: "vocab",
        titel: `Woordjes — hoofdstuk ${b.hoofdstuk}`,
        aantal: b.items.length,
        richtingen,
        bouwCards: (richting = richtingen[0]) =>
          b.items.map((it): Card => {
            const k = bouwKaart(it, richting);
            return {
              kind: "typed",
              id: it.id,
              prompt: k.prompt,
              accepted: k.accepted,
              norm: b.normalisatie,
              answer: richting === "nl->vreemd" ? it.vreemd : it.nl,
            };
          }),
      });
    } else if (file === "flashcards.json") {
      const b = data as FlashcardBestand;
      blokken.push({
        id: `${vak}/flashcards`,
        vak,
        soort: "flashcards",
        titel: "Begrippen & feiten",
        aantal: b.kaarten.length,
        bouwCards: () =>
          b.kaarten.map((k): Card => {
            if (k.modus === "kaart") {
              return {
                kind: "flip",
                id: k.id,
                front: k.vraag,
                back: k.antwoord,
                image: resolveImage(k.afbeelding),
              };
            }
            return {
              kind: "typed",
              id: k.id,
              prompt: k.vraag,
              accepted: [k.antwoord, ...(k.acceptedAnswers ?? [])],
              norm: k.normalisatie ?? b.normalisatie,
              answer: k.antwoord,
              image: resolveImage(k.afbeelding),
            };
          }),
      });
    } else if (file === "oefenvragen.json") {
      const b = data as OefenvraagBestand;
      blokken.push({
        id: `${vak}/oefenvragen`,
        vak,
        soort: "oefenvragen",
        titel: "Begripsvragen (open)",
        aantal: b.vragen.length,
        bouwCards: () =>
          b.vragen.map((v): Card => ({
            kind: "flip",
            id: v.id,
            front: v.vraag,
            back: v.modelAntwoord,
            rubric: v.rubric,
          })),
      });
    }
  }
  return blokken;
}

export const BLOKKEN: Blok[] = buildBlokken();

const SOORT_ORDER: Record<BlokSoort, number> = {
  vocab: 0,
  flashcards: 1,
  oefenvragen: 2,
};

export function vakGroepen(): VakGroep[] {
  const map = new Map<string, Blok[]>();
  for (const b of BLOKKEN) {
    if (!map.has(b.vak)) map.set(b.vak, []);
    map.get(b.vak)!.push(b);
  }
  return [...map.entries()]
    .map(([vak, blokken]) => ({
      vak,
      blokken: blokken.sort((x, y) => SOORT_ORDER[x.soort] - SOORT_ORDER[y.soort]),
    }))
    .sort((a, b) => vakLabel(a.vak).localeCompare(vakLabel(b.vak)));
}
