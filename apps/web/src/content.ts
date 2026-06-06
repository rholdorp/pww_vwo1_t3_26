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

// Alleen mappen waaruit flashcards een referentie-afbeelding gebruiken (nu enkel
// aardrijkskunde-topografie). Bewust smal zodat grote raw-scans niet mee de bundle in gaan.
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
  const k = Object.keys(imageUrls).find((x) => x.endsWith(rel));
  return k ? imageUrls[k] : undefined;
}
function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
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

/** Interne categorie (niet tonen in UI). */
export type BlokSoort = "woordjes" | "begrippen" | "uitlegvragen";

/** Stijn-vriendelijk label per soort — géén "Cat 1/3". */
export const SOORT_LABEL: Record<BlokSoort, string> = {
  woordjes: "Woordjes",
  begrippen: "Begrippen",
  uitlegvragen: "Uitlegvragen",
};
export const SOORT_ICON: Record<BlokSoort, string> = {
  woordjes: "💬",
  begrippen: "📖",
  uitlegvragen: "💡",
};

/** Eén oefen-eenheid: één onderdeel/paragraaf van één vak. */
export interface Blok {
  id: string;
  vak: string;
  hoofdstuk: string;
  onderdeel: string;
  soort: BlokSoort;
  titel: string;
  ids: string[];
  richtingen?: Richting[];
  bouwCards: (richting?: Richting) => Card[];
}

export interface HoofdstukGroep {
  hoofdstuk: string;
  blokken: Blok[];
}
export interface VakGroep {
  vak: string;
  hoofdstukken: HoofdstukGroep[];
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
// Vak-accentkleuren overgenomen uit de vorige trainer (look & feel Stijn).
const VAK_KLEUR: Record<string, string> = {
  wiskunde: "#3498DB",
  nederlands: "#E67E22",
  frans: "#9B59B6",
  engels: "#E91E63",
  geschiedenis: "#E74C3C",
  biologie: "#27AE60",
  aardrijkskunde: "#F1C40F",
};
export function vakLabel(vak: string): string {
  return VAK_LABEL[vak] ?? vak;
}
export function vakKleur(vak: string): string {
  return VAK_KLEUR[vak] ?? "#6366f1";
}
export function richtingLabel(vak: string, r: Richting): string {
  const v = vakLabel(vak);
  return r === "nl->vreemd" ? `Nederlands → ${v}` : `${v} → Nederlands`;
}

function typedFlashcard(k: FlashcardBestand["kaarten"][number], norm: NormalisatieProfiel): Card {
  if (k.modus === "kaart") {
    return { kind: "flip", id: k.id, front: k.vraag, back: k.antwoord, image: resolveImage(k.afbeelding) };
  }
  return {
    kind: "typed",
    id: k.id,
    prompt: k.vraag,
    accepted: [k.antwoord, ...(k.acceptedAnswers ?? [])],
    norm: k.normalisatie ?? norm,
    answer: k.antwoord,
    image: resolveImage(k.afbeelding),
  };
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
      // Splits per hoofdstuk (meestal één); houdt de scheiding zichtbaar.
      for (const [hfd, items] of groupBy(b.items, (it) => it.hoofdstuk || b.hoofdstuk)) {
        blokken.push({
          id: `${vak}/woordjes/h${hfd}`,
          vak,
          hoofdstuk: hfd,
          onderdeel: `Hoofdstuk ${hfd}`,
          soort: "woordjes",
          titel: "Woordjes",
          ids: items.map((it) => it.id),
          richtingen,
          bouwCards: (richting = richtingen[0]) =>
            items.map((it): Card => {
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
      }
    } else if (file === "flashcards.json") {
      const b = data as FlashcardBestand;
      for (const [onderdeel, kaarten] of groupBy(b.kaarten, (k) => k.onderdeel ?? `Hoofdstuk ${k.hoofdstuk}`)) {
        blokken.push({
          id: `${vak}/begrippen/${onderdeel}`,
          vak,
          hoofdstuk: kaarten[0].hoofdstuk,
          onderdeel,
          soort: "begrippen",
          titel: onderdeel,
          ids: kaarten.map((k) => k.id),
          bouwCards: () => kaarten.map((k) => typedFlashcard(k, b.normalisatie)),
        });
      }
    } else if (file === "oefenvragen.json") {
      const b = data as OefenvraagBestand;
      for (const [onderdeel, vragen] of groupBy(b.vragen, (v) => v.onderdeel ?? `Hoofdstuk ${v.hoofdstuk}`)) {
        blokken.push({
          id: `${vak}/uitlegvragen/${onderdeel}`,
          vak,
          hoofdstuk: vragen[0].hoofdstuk,
          onderdeel,
          soort: "uitlegvragen",
          titel: onderdeel,
          ids: vragen.map((v) => v.id),
          bouwCards: () =>
            vragen.map((v): Card => ({
              kind: "flip",
              id: v.id,
              front: v.vraag,
              back: v.modelAntwoord,
              rubric: v.rubric,
            })),
        });
      }
    }
  }
  return blokken;
}

export const BLOKKEN: Blok[] = buildBlokken();

const SOORT_ORDER: Record<BlokSoort, number> = { woordjes: 0, begrippen: 1, uitlegvragen: 2 };

function hfdNum(h: string): number {
  const n = parseInt(h, 10);
  return Number.isNaN(n) ? 999 : n;
}

export function vakGroepen(): VakGroep[] {
  const perVak = groupBy(BLOKKEN, (b) => b.vak);
  const groepen: VakGroep[] = [];
  for (const [vak, blokken] of perVak) {
    const perHfd = groupBy(blokken, (b) => b.hoofdstuk);
    const hoofdstukken: HoofdstukGroep[] = [...perHfd.entries()]
      .map(([hoofdstuk, bl]) => ({
        hoofdstuk,
        blokken: bl.sort(
          (a, b) => SOORT_ORDER[a.soort] - SOORT_ORDER[b.soort] || a.onderdeel.localeCompare(b.onderdeel),
        ),
      }))
      .sort((a, b) => hfdNum(a.hoofdstuk) - hfdNum(b.hoofdstuk));
    groepen.push({ vak, hoofdstukken });
  }
  return groepen.sort((a, b) => vakLabel(a.vak).localeCompare(vakLabel(b.vak)));
}
