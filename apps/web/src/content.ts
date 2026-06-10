import type {
  VocabBestand,
  FlashcardBestand,
  OefenvraagBestand,
  OpgavenBestand,
  SchrijfopdrachtBestand,
  Schrijfopdracht,
  DiagramBestand,
  NormalisatieProfiel,
  Richting,
} from "@pww/shared";
import { bouwKaart } from "@pww/trainer-engine";

// Alle trainer-content wordt bij build/dev meegebundeld (static, geen Firestore).
const jsonModules = import.meta.glob(
  "../../../content/2026-t3/trainers/**/*.json",
  { eager: true },
) as Record<string, { default: unknown }>;

// Alleen mappen waaruit content een referentie-afbeelding gebruikt: aardrijkskunde-
// topografie + wiskunde-meetkundefiguren (bijgesneden uit de lesboekpagina's). Bewust
// smal zodat de grote ongesneden raw-scans niet mee de bundle in gaan.
const imageUrls = import.meta.glob(
  [
    "../../../content/2026-t3/raw/aardrijkskunde/*.{jpg,jpeg,png}",
    "../../../content/2026-t3/assets/wiskunde/**/*.{jpg,jpeg,png}",
  ],
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

// Shaped diagram-SVG's (data-region per onderdeel) worden als ruwe tekst geladen
// zodat we ze inline in de DOM kunnen zetten en regio's kunnen aanklikken/oplichten.
const svgRaw = import.meta.glob(
  "../../../content/2026-t3/assets/**/*.svg",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;
function resolveSvg(rel?: string): string | undefined {
  if (!rel) return undefined;
  const k = Object.keys(svgRaw).find((x) => x.endsWith(rel));
  return k ? svgRaw[k] : undefined;
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

// ~20 kaarten per onderwerp houdt de focus vast (Stijn-feedback).
const WOORD_MAX = 22;

/** Leid een onderwerp af uit de context van een frans vocab-item (voor groepering). */
function fransOnderwerp(ctx: string | undefined): string {
  const c = (ctx ?? "").toLowerCase();
  if (c.includes("phrases-cl")) return "Zinnen oefenen";
  if (c.includes("vraagwoord")) return "Vraagwoorden";
  if (c.includes("sectie a")) return "De weg & vervoer";
  if (c.includes("sectie b")) return "In de stad";
  if (c.includes("sectie e")) return "Dagelijks leven";
  if (c.includes("hoofdstukverhaal")) return "Woorden uit het verhaal";
  return "Werkwoorden & woorden";
}

/** Verdeel een lijst in zo gelijk mogelijke stukken van ≤ n. */
function chunk<T>(arr: T[], n: number): T[][] {
  if (arr.length <= n) return [arr];
  const delen = Math.ceil(arr.length / n);
  const per = Math.ceil(arr.length / delen);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += per) out.push(arr.slice(i, i + per));
  return out;
}

/** Eén te oefenen kaart, klaar voor de UI. */
export type Card =
  | {
      kind: "typed";
      id: string;
      prompt: string;
      /** Optionele gedempte koptekst boven de prompt (bv. "Welk begrip past bij deze omschrijving?"). */
      subtitel?: string;
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
    }
  | {
      kind: "opgave";
      id: string;
      /** Paragraaf-sleutel (onderdeel) voor de Cat-2-engine, bv. "8.2". */
      onderdeel: string;
      /** Leesbare onderdeel-titel, bv. "§8.2 Haakjes wegwerken". */
      onderdeelTitel: string;
      isSynthese: boolean;
      /** De opgave-tekst (instructie + expressie). */
      vraag: string;
      /** Optionele figuur bij de opgave (meetkunde) — URL. */
      image?: string;
      /** Het juiste eindantwoord (simpelste vorm, antwoordenboekje). */
      answer: string;
      /** Extra geaccepteerde gelijkwaardige vormen. */
      accepted: string[];
      /** Strikt op vorm graderen (wetenschappelijke notatie) i.p.v. waarde. */
      exacteVorm: boolean;
      /** Vraagtype (weergave). */
      type: string;
    }
  | {
      kind: "hotspot";
      id: string;
      /** "benoem" = regio licht op, typ de naam; "aanwijs" = naam gegeven, klik de regio. */
      richting: "benoem" | "aanwijs";
      /** data-region (shaped SVG) of marker-id (overlay) van het juiste antwoord. */
      targetId: string;
      naam: string;
      accepted: string[];
      norm: NormalisatieProfiel;
      benoemVraag: string;
      hint?: string;
      /** Shaped SVG-tekst (biologie) — inline in de DOM. */
      svgInline?: string;
      /** Achtergrondafbeelding-URL (overlay-modus, topo). */
      image?: string;
      /** Cirkel-overlay-posities per regio (overlay-modus). */
      markers?: { id: string; x: number; y: number }[];
    };

/** Interne categorie (niet tonen in UI). */
export type BlokSoort = "woordjes" | "begrippen" | "uitlegvragen" | "invullen" | "vertalen" | "schrijven" | "diagram" | "opgaven";

/** Stijn-vriendelijk label per soort — géén "Cat 1/3". */
export const SOORT_LABEL: Record<BlokSoort, string> = {
  woordjes: "Woordjes",
  begrippen: "Begrippen",
  uitlegvragen: "Uitlegvragen",
  invullen: "Invullen",
  vertalen: "Zinnen vertalen",
  schrijven: "Schrijfoefening",
  diagram: "Op de afbeelding",
  opgaven: "Opgaven oefenen",
};
export const SOORT_ICON: Record<BlokSoort, string> = {
  woordjes: "💬",
  begrippen: "📖",
  uitlegvragen: "💡",
  invullen: "🔤",
  vertalen: "🔁",
  schrijven: "✍️",
  diagram: "🖼️",
  opgaven: "✏️",
};

/** Schrijfopdrachten (Cat 4), opzoekbaar op id voor de schrijftrainer. */
export const SCHRIJFOPDRACHTEN = new Map<string, Schrijfopdracht>();

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
  /** Alleen bij soort "opgaven" (Cat 2): de onderdeel-sleutels (paragrafen) in dit blok. */
  onderdelen?: string[];
  /** Alleen bij soort "schrijven": verwijzing naar de schrijfopdracht. */
  opdrachtId?: string;
  /** Optioneel: maximaal aantal kaarten per ronde (bv. "kies 10 willekeurig"). */
  sessieLimiet?: number;
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
  // Omschrijvingskaarten tonen anders alleen de definitie als stelling. Die krijgen
  // een gedempte subtitel ("Welk begrip past bij deze omschrijving?") boven de prompt.
  // Al-vraag-geformuleerde kaarten (bevatten ergens een "?" — bv. jaartal/feit-vragen
  // met een staartje als "(tijdbalk)") blijven kaal: de vraag spreekt voor zich.
  const isVraag = k.vraag.includes("?");
  return {
    kind: "typed",
    id: k.id,
    prompt: k.vraag,
    subtitel: isVraag ? undefined : "Welk begrip past bij deze omschrijving?",
    accepted: [k.antwoord, ...(k.acceptedAnswers ?? [])],
    norm: k.normalisatie ?? norm,
    answer: k.antwoord,
    image: resolveImage(k.afbeelding),
  };
}

function buildRuw(): Blok[] {
  const blokken: Blok[] = [];

  for (const [path, mod] of Object.entries(jsonModules)) {
    const vak = vakFromPath(path);
    const file = fileFromPath(path);
    const data = mod.default;

    if (file === "vocab.json" || file === "werkwoorden.json") {
      const b = data as VocabBestand;
      const isWerkw = file === "werkwoorden.json";
      const richtingen = b.richtingen?.length ? b.richtingen : (["nl->vreemd"] as Richting[]);
      type Items = VocabBestand["items"];
      const maakBouwer =
        (items: Items) =>
        (richting: Richting = richtingen[0]): Card[] =>
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
          });

      if (isWerkw) {
        // Werkwoorden blijven één blok (vervoegen).
        for (const [hfd, items] of groupBy(b.items, (it) => it.hoofdstuk || b.hoofdstuk)) {
          blokken.push({
            id: `${vak}/werkwoorden/h${hfd}`,
            vak,
            hoofdstuk: hfd,
            onderdeel: "Werkwoorden",
            soort: "woordjes",
            titel: "Werkwoorden vervoegen",
            ids: items.map((it) => it.id),
            richtingen,
            bouwCards: maakBouwer(items),
          });
        }
      } else {
        // Groepeer woordjes per onderwerp (~20 per blok) zodat de focus behapbaar
        // blijft; grote onderwerpen splitsen in "(deel n)". De Leitner-requeue +
        // due-first sessievolgorde laat foute woorden vanzelf terugkomen.
        for (const [onderwerp, items] of groupBy(b.items, (it) => fransOnderwerp(it.context))) {
          const delen = chunk(items, WOORD_MAX);
          delen.forEach((deel, i) => {
            const label = delen.length > 1 ? `${onderwerp} (deel ${i + 1})` : onderwerp;
            blokken.push({
              id: `${vak}/woordjes/${onderwerp.replace(/\s+/g, "-").toLowerCase()}-${i}`,
              vak,
              hoofdstuk: b.hoofdstuk,
              onderdeel: label,
              soort: "woordjes",
              titel: label,
              ids: deel.map((it) => it.id),
              richtingen,
              bouwCards: maakBouwer(deel),
            });
          });
        }
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
    } else if (file === "schrijfopdrachten.json") {
      const b = data as SchrijfopdrachtBestand;
      b.opdrachten.forEach((op, i) => {
        SCHRIJFOPDRACHTEN.set(op.id, op);
        blokken.push({
          id: `${vak}/schrijven/${op.id}`,
          vak,
          hoofdstuk: "schrijven",
          onderdeel: `${i + 1}. ${op.titel}`,
          soort: "schrijven",
          titel: `${i + 1}. ${op.titel}`,
          ids: [op.id],
          opdrachtId: op.id,
          bouwCards: () => [],
        });
      });
    } else if (file === "vertaalzinnen.json") {
      const b = data as {
        hoofdstuk: string;
        normalisatie: NormalisatieProfiel;
        sessieLimiet?: number;
        items: Array<{ id: string; nl: string; vreemd: string; acceptedAnswers?: string[] }>;
      };
      blokken.push({
        id: `${vak}/vertalen/h${b.hoofdstuk}`,
        vak,
        hoofdstuk: b.hoofdstuk,
        onderdeel: "Zinnen vertalen",
        soort: "vertalen",
        titel: "Zinnen vertalen (NL → FR)",
        ids: b.items.map((it) => it.id),
        sessieLimiet: b.sessieLimiet ?? 10,
        bouwCards: () =>
          b.items.map((it): Card => ({
            kind: "typed",
            id: it.id,
            prompt: it.nl,
            accepted: [it.vreemd, ...(it.acceptedAnswers ?? [])],
            norm: b.normalisatie,
            answer: it.vreemd,
          })),
      });
    } else if (file === "hoofdstukverhaal-cloze.json") {
      const b = data as {
        hoofdstuk: string;
        onderdeel?: string;
        normalisatie: NormalisatieProfiel;
        items: Array<{ id: string; zin: string; infinitief: string; tijd?: string; antwoord: string; acceptedAnswers?: string[] }>;
      };
      blokken.push({
        id: `${vak}/invullen/h${b.hoofdstuk}`,
        vak,
        hoofdstuk: b.hoofdstuk,
        onderdeel: b.onderdeel ?? "Werkwoorden invullen",
        soort: "invullen",
        titel: "Werkwoorden invullen (verhaal)",
        ids: b.items.map((it) => it.id),
        bouwCards: () =>
          b.items.map((it): Card => ({
            kind: "typed",
            id: it.id,
            prompt: `${it.zin}  (${it.infinitief})`,
            accepted: [it.antwoord, ...(it.acceptedAnswers ?? [])],
            norm: b.normalisatie,
            answer: it.antwoord,
          })),
      });
    } else if (file === "opgaven.json") {
      // Cat 2 (wiskunde): één blok per hoofdstuk; de Cat-2-engine doet adaptief
      // per onderdeel (paragraaf). Synthese-onderdelen pas vrij na de losse.
      const b = data as OpgavenBestand;
      for (const [hfd, opg] of groupBy(b.opgaven, (o) => o.hoofdstuk)) {
        const onderdelen = [...new Set(opg.map((o) => o.onderdeel))];
        blokken.push({
          id: `${vak}/opgaven/h${hfd}`,
          vak,
          hoofdstuk: hfd,
          onderdeel: `Hoofdstuk ${hfd} — opgaven`,
          soort: "opgaven",
          titel: `Opgaven oefenen (H${hfd})`,
          ids: opg.map((o) => o.id),
          onderdelen,
          bouwCards: () =>
            opg.map((o): Card => ({
              kind: "opgave",
              id: o.id,
              onderdeel: o.onderdeel,
              onderdeelTitel: o.onderdeelTitel,
              isSynthese: !!o.isSynthese,
              vraag: o.vraag,
              image: resolveImage(o.afbeelding),
              answer: o.antwoord,
              accepted: o.acceptedForms ?? [],
              exacteVorm: !!o.exacteVorm,
              type: o.type,
            })),
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
    } else if (file === "diagram.json") {
      const b = data as DiagramBestand;
      for (const d of b.diagrammen) {
        const richtingen = d.richtingen?.length ? d.richtingen : (["aanwijs", "benoem"] as const);
        const norm = d.normalisatie ?? "begrip";
        const benoemVraag = d.benoemVraag ?? "Welk onderdeel is dit?";
        const svgInline = resolveSvg(d.svg);
        const image = resolveImage(d.afbeelding);
        const ids = d.regios.map((r) => `${d.id}-${r.id}`);
        // Twee blokken per diagram (aanwijzen / benoemen); ze delen dezelfde
        // Leitner-ids zodat mastery over beide richtingen samenvalt.
        for (const richting of richtingen) {
          const label = richting === "aanwijs" ? "aanwijzen" : "benoemen";
          blokken.push({
            id: `${vak}/diagram/${d.id}/${richting}`,
            vak,
            hoofdstuk: d.hoofdstuk ?? "",
            onderdeel: d.titel,
            soort: "diagram",
            titel: `${d.titel} — ${label}`,
            ids,
            bouwCards: () =>
              d.regios.map((r): Card => ({
                kind: "hotspot",
                id: `${d.id}-${r.id}`,
                richting,
                targetId: r.id,
                naam: r.naam,
                accepted: [r.naam, ...(r.acceptedAnswers ?? [])],
                norm,
                benoemVraag,
                hint: r.hint,
                svgInline,
                image,
                markers: d.markers,
              })),
          });
        }
      }
    }
  }
  return blokken;
}

// Een blok onder deze grootte voelt te mager; we combineren het slim met buren.
const MIN_KAARTEN = 6;

function paragraafLabel(b: Blok): string {
  return b.onderdeel.match(/§\d+\.\d+/)?.[0] ?? b.onderdeel;
}

function combineer(a: Blok, b: Blok, opts?: Partial<Pick<Blok, "id" | "onderdeel" | "titel" | "hoofdstuk">>): Blok {
  const onderdeel = opts?.onderdeel ?? `${paragraafLabel(a)} + ${paragraafLabel(b)}`;
  return {
    id: opts?.id ?? `${a.id}+${b.id}`,
    vak: a.vak,
    hoofdstuk: opts?.hoofdstuk ?? a.hoofdstuk,
    onderdeel,
    soort: a.soort,
    titel: opts?.titel ?? onderdeel,
    ids: [...a.ids, ...b.ids],
    richtingen: a.richtingen,
    bouwCards: (r) => [...a.bouwCards(r), ...b.bouwCards(r)],
  };
}

/** Voeg per (vak,hoofdstuk,soort) de paragraaf-blokken <MIN samen met een buur. */
function bundelKlein(blokken: Blok[]): Blok[] {
  const sorted = [...blokken].sort((x, y) => x.onderdeel.localeCompare(y.onderdeel));
  const out: Blok[] = [];
  let buf: Blok | null = null;
  for (const b of sorted) {
    if (buf) {
      buf = combineer(buf, b);
      if (buf.ids.length >= MIN_KAARTEN) {
        out.push(buf);
        buf = null;
      }
    } else if (b.ids.length < MIN_KAARTEN) {
      buf = b;
    } else {
      out.push(b);
    }
  }
  if (buf) {
    if (out.length > 0) out[out.length - 1] = combineer(out[out.length - 1], buf);
    else out.push(buf);
  }
  return out;
}

function buildBlokken(): Blok[] {
  const ruw = buildRuw();
  const final: Blok[] = [];

  // Woordjes, invul-/vertaal-oefeningen, schrijfopdrachten, diagrammen + opgaven (Cat 2): ongemoeid.
  final.push(
    ...ruw.filter(
      (b) =>
        b.soort === "woordjes" ||
        b.soort === "invullen" ||
        b.soort === "vertalen" ||
        b.soort === "schrijven" ||
        b.soort === "diagram" ||
        b.soort === "opgaven",
    ),
  );

  // Begrippen: per (vak, hoofdstuk) de te kleine paragrafen samenvoegen,
  // de rest blijft per paragraaf gescheiden.
  const begrippen = ruw.filter((b) => b.soort === "begrippen");
  for (const [, groep] of groupBy(begrippen, (b) => `${b.vak}|${b.hoofdstuk}`)) {
    final.push(...bundelKlein(groep));
  }

  // Uitlegvragen: inherent klein per paragraaf → één review-blok per vak.
  const uitleg = ruw.filter((b) => b.soort === "uitlegvragen");
  for (const [vak, groep] of groupBy(uitleg, (b) => b.vak)) {
    const meta = { id: `${vak}/uitlegvragen`, hoofdstuk: "uitleg", onderdeel: "Uitlegvragen", titel: "Uitlegvragen" };
    const samen = groep.reduce((acc, b) => combineer(acc, b, meta));
    final.push({ ...samen, ...meta });
  }

  return final;
}

export const BLOKKEN: Blok[] = buildBlokken();

const SOORT_ORDER: Record<BlokSoort, number> = { opgaven: 0, woordjes: 1, invullen: 2, vertalen: 3, begrippen: 4, diagram: 5, uitlegvragen: 6, schrijven: 7 };

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
