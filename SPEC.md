# Proefwerkweek Trainer & Planner — Specificatie

**Doelgebruiker (initieel):** Stijn, klas 1 Atheneum, trimester 3 proefwerkweek 2026
**Status:** Concept / in iteratie
**Laatste update:** 2026-06-03

---

## 1. Doel

Een webapp die scholieren helpt om zich gericht en in haalbare stukjes voor te bereiden op hun proefwerkweek. De app bestaat uit twee samenhangende onderdelen:

1. **Planner met voortgang** — een dag-voor-dag studieplan dat rekening houdt met de schooltijden, thuiscontext, aandachtsspanne en het PWW-rooster. De planner laat zien wat vandaag moet gebeuren en houdt voortgang bij.
2. **Trainers per vak** — interactieve oefenmodules die per vakcategorie de juiste leerstrategie toepassen (zie §5). Elke trainer haalt zijn content uit een aparte content-laag, los van de code.

## 2. Kernuitgangspunten

| # | Principe | Consequentie |
|---|---|---|
| P1 | **Content los van code** | Volgend jaar nieuwe screenshots uploaden → nieuwe trainer zonder code wijzigen. Geen subject-specifieke logica hard-coded. |
| P2 | **Ruwe bron is leidend** | Screenshots van fysiek boek/schrift zijn de "source of truth". Trainercontent wordt afgeleid, niet zelfstandig verzonnen. **Uitzondering: wiskunde-antwoorden** staan niet in het leerlingboek — die worden door een aparte solver afgeleid en door Ralph bevestigd bij twijfel (zie §4). |
| P3 | **Validatie van content** | Een aparte agent vergelijkt de gegenereerde trainercontent met de ruwe screenshots: niets gemist, niets gehallucineerd. |
| P4 | **Korte blokken, lage drempel** | Maximaal 30 min per blok (cat. 1: 15 min), max 1.5 uur per dag, met pauzes. |
| P5 | **Klaar vóór de laatste week** | Eerste leerronde afgerond vóór de week direct vóór de PWW. Die laatste week is alleen herhalen + automatiseren. |
| P6 | **Multi-user / deelbaar** | Klasgenoten kunnen meedoen en hun eigen voortgang bijhouden op dezelfde content. |
| P7 | **Mobile-first responsive** | Bruikbaar op telefoon (avond op de bank) én PC (achter bureau). |
| P8 | **Volledigheid boven snelheid** | De tool is Stijns *single source of truth*. Een vak gaat pas live als de scope 100% gedekt én gevalideerd is; anders toont de app "leer uit boek". Een onvolledige tool is gevaarlijker dan geen tool — eerder is gemiste stof precies op de toets gekomen. Deadline is ondergeschikt aan volledigheid. |

## 3. Monorepo folderstructuur

```
pww_vwo1_t3_26/
├── content/                      # Per editie (jaar/trimester), los van code
│   └── 2026-t3/
│       ├── raw/                  # P2: ruwe screenshots, source of truth
│       │   ├── frans/
│       │   ├── engels/
│       │   ├── nederlands/
│       │   ├── wiskunde/
│       │   ├── aardrijkskunde/
│       │   ├── biologie/
│       │   └── geschiedenis/
│       ├── trainers/             # Afgeleide trainer-content (JSON/YAML/MD)
│       │   ├── frans/
│       │   │   ├── vocab.json    # woordenlijsten
│       │   │   └── zinnen.json
│       │   ├── wiskunde/
│       │   │   └── opgaven.json  # opgaven met onderdeel-tag (3.2a, 3.2b, ...)
│       │   ├── biologie/         # Cat. 3 = samenvatting + vragen
│       │   │   ├── samenvatting/
│       │   │   │   └── cellen.md
│       │   │   ├── flashcards.json
│       │   │   ├── oefenvragen.json
│       │   │   └── diagram.json   # gelabelde diagrammen (Cat. 1 met beeld-prompt)
│       │   ├── nederlands/       # Cat. 4 = tekst + vragen
│       │   │   ├── teksten/
│       │   │   │   └── tekst-1.md
│       │   │   └── vragen/
│       │   │       └── tekst-1.json
│       │   └── ...
│       ├── assets/               # afbeeldingen/diagrammen, uitgesneden uit raw — reizen mee met editie (P1)
│       │   ├── biologie/
│       │   └── wiskunde/
│       └── manifest.yaml         # vakken, toetsdatums + scope-checklist per vak (completeness-gate, §4)
│
├── apps/
│   ├── web/                      # de webapp (UI + planner + trainers)
│   └── validator/                # P3: agent die trainers vs raw vergelijkt
│
├── packages/
│   ├── trainer-engine/           # generieke trainer-logica per categorie (cat 1–4)
│   ├── planner-engine/           # planning-algoritme
│   └── shared/                   # types, utils
│
├── progress/                     # per-gebruiker voortgangsdata (server-side)
│
└── SPEC.md                       # dit document
```

**Waarom deze splitsing:** `content/2026-t3/` is volledig zelfstandig. Volgend jaar maak je `content/2026-t4/` of `content/2027-t1/` aan, zonder code te raken (P1). De trainer-engines weten alleen *hoe* ze categorie-1 of categorie-2 moeten draaien, niet welke specifieke woordjes erin zitten.

## 4. Content pipeline

### Doel

Eén herbruikbaar proces dat ruwe screenshots → goedgekeurde trainer-content omzet, met ingebouwde quality stack en één menselijke review-stap vóór deploy. Volgend jaar = nieuwe folder, zelfde proces, **geen code wijzigen**.

### Overzicht — 6 stages

```
Stage 0  Capture       Foto/scan → content/<editie>/raw/<vak>/...
            │           (handmatig)
            ▼
Stage 1  Classify      Vision: vak (cross-check folder), cat 1-4, content-type
            │           confidence < 0.85 → review-queue
            ▼
Stage 2  Extract       Multi-pass extractie (Pass A + Pass B + self-critique)
            │           - Cat. 3: ook samenvatting-generatie
            │           - Wiskunde: math-solver met confidence (Stage 2.5)
            ▼
Stage 3  Convert       Map naar canonieke trainer-formats, stable IDs, dedupe
            │
            ▼
Stage 4  Validate      Bidirectional raw ↔ trainer check (zie §6)
            │
            ▼
Stage 5  Review        Mens-in-the-loop: review-queue (markdown + CLI)
            │           verplicht leeg vóór Stage 6 (voor strikte content-types)
            ▼
Stage 6  Deploy        Approved content → Firestore (atomic per vak)
```

Stages 0-4 zijn (semi-)geautomatiseerd; Stage 5 is verplicht-handmatig vóór Stage 6.

### Twee lagen van volledigheid (completeness-gate) — P8

De tool is Stijns single source of truth. "Volledig" betekent **twee** dingen, en de pipeline borgt ze apart:

| Laag | Vraag | Geborgd door |
|---|---|---|
| **(a) Scope-coverage** | Zijn álle toetsbare onderdelen (hoofdstukken/§/woordenlijsten) überhaupt vastgelegd? | **Scope-checklist in `manifest.yaml`** — de validator ziet dit NIET |
| **(b) Extractie-fideliteit** | Is alles uit de aanwezige screenshots correct + compleet overgenomen? | Validator (§6, bidirectionele diff) |

> Een perfecte validator (laag b) voorkomt geen gemiste stof als een pagina nooit gefotografeerd is (laag a). De eerder gemiste content die op de toets kwam, was vrijwel zeker laag (a). **Beide moeten 100% zijn voordat een vak als compleet/vertrouwd live gaat.**

**Scope-checklist per vak (in `manifest.yaml`):** elk in-scope onderdeel krijgt een regel met drie vinkjes:

```yaml
vakken:
  frans:
    scope:
      - id: h5-phrases-cles
        bron: "Chapitre 5, p.42"
        gefotografeerd: true      # (i) raw aanwezig
        geextraheerd: true        # (ii) trainer-content gegenereerd
        gevalideerd: true         # (iii) validator pass
      - id: h5-grammaire-adjectieven
        bron: "Chapitre 5, p.37"
        gefotografeerd: true
        geextraheerd: false
        gevalideerd: false
```

**Completeness-gate:** een vak is pas `compleet` als **elk** scope-item alle drie de vinkjes heeft. Niet-complete vakken → de app toont expliciet *"nog niet volledig — leer dit vak uit het boek"* (P8). De scope-lijst zelf (welke stof toetsbaar is) komt van Stijn/docent en is daarmee een **verplichte, completeness-kritische input** — niet optioneel, niet deferred.

### Stage 0 — Capture

Handmatig. Foto met telefoon of scan, dropt in `content/<editie>/raw/<vak>/`. Bestandsnaam-conventie (optioneel maar handig):

```
<vak>-h<hoofdstuk>-p<pagina>[-<n>].jpg
bv. frans-h5-p47.jpg, wiskunde-h3-p84-2.jpg
```

Folder bepaalt vak; Stage 1 cross-checkt.

### Stage 1 — Classify

Per nieuw of gewijzigd bestand één Opus vision-call:
- **Vak** detecteren en cross-checken met folder (mismatch → review)
- **Content-type**: woordenlijst / opgaven / theorie / oefentekst / antwoordpagina / overig
- **Primaire categorie** (1-4) op basis van content-type

Output: `<bestand>.classify.json` als metadata-stub naast de raw file. Confidence < 0.85 → review-queue.

### Stage 2 — Extract (multi-pass + self-critique)

Per geclassificeerd bestand, **categorie-specifieke prompt**:

1. **Pass A** — vision extraheert gestructureerde data (zie format per vak in Stage 3).
2. **Pass B** — onafhankelijke vision-call met **andere prompt-formulering**, zelfde input.
3. **Self-critique pass** — vision controleert eigen output: *"kijk opnieuw naar het plaatje en bevestig: heb je ALLE items? Heb je iets verzonnen?"*
4. **Compare A vs B** — items die in **beide** passes verschijnen → high confidence. Items in alleen één → **review-queue**.
5. **Voor Cat. 3** — extra pass genereert `samenvatting/<onderwerp>.md` (~300-600 woorden, kernbegrippen vetgedrukt, kruisverbanden expliciet). Wordt in Stage 4 ge-cross-checked op compleetheid van kernbegrippen.
6. **Voor Wiskunde** — opgave-tekst en metadata uit raw; **antwoorden NIET uit raw** (zie Stage 2.5).

Output: `<bestand>.extract.json` per bestand, met per item een confidence en `passes: ["A","B"]` herkomst.

### Stage 2.5 — Wiskunde-antwoord-verificatie (apart script)

Wiskunde-antwoorden staan **niet** in het leerlingboek (Getal & Ruimte heeft alleen antwoorden in de docentenversie of het antwoordenboek). De pipeline moet ze dus zelf afleiden — maar met expliciete confidence en menselijke review bij twijfel, omdat een fout antwoord een verkeerde reflex traint.

Wiskunde-antwoorden staan **niet** in het leerlingboek (Getal & Ruimte heeft alleen antwoorden in de docentenversie of het antwoordenboek). De pipeline moet ze dus zelf afleiden — maar met expliciete confidence en menselijke review bij twijfel, omdat een fout antwoord een verkeerde reflex traint.

**Apart script:** `apps/validator/src/math-solver.ts`, draaibaar met `npm run solve-math -- --vak=wiskunde`.

**Algoritme per opgave:**

1. **Dubbele oplossing** — twee onafhankelijke Claude-calls (verschillende systeemprompts) lossen dezelfde opgave op. Beide krijgen toegang tot het **Code Execution tool** (Python + sympy), zodat ze symbolisch + numeriek kunnen rekenen i.p.v. uit het hoofd.
2. **Normalisatie** — beide antwoorden in canonieke vorm (`x = 5` → `5`, breuken vereenvoudigd, lijsten gesorteerd).
3. **Confidence-bepaling:**
   | Confidence | Conditie | Gedrag |
   |---|---|---|
   | **HIGH** (≥0.95) | Beide solvers exact eens, symbolisch + numeriek | Auto-approve, opslaan in trainer-content |
   | **MEDIUM** (0.70-0.94) | Solvers eens op afgerond numeriek antwoord maar verschillende vorm | Auto-approve met note; Ralph kan reviewen indien gewenst |
   | **LOW** (<0.70) | Solvers oneens, of een solver gaf zelf onzekerheid aan, of opgave heeft tekst die niet geparseerd kon worden | **Flag voor Ralph review** |

4. **Review-queue voor LOW-confidence** — script schrijft naar `apps/validator/reports/wiskunde-review-needed.md`:
   ```markdown
   ## §3.2 opgave 12a
   Vraag: Los op: 3x + 7 = 22
   Bron: raw/wiskunde/h3-p84.jpg

   Solver A: x = 5  (confidence 0.92)
   Solver B: x = 5  (confidence 0.93)

   ## §3.5 opgave 18b
   Vraag: [niet-leesbare tekst]
   Bron: raw/wiskunde/h3-p91.jpg

   Solver A: x = 3, y = 7  (confidence 0.40)
   Solver B: geen oplossing gevonden  (confidence 0.30)

   → Ralph: bevestig of vul juist antwoord in.
   ```

5. **Interactieve Ralph-review:** `npm run review-math` opent een CLI-prompt per LOW-item met:
   - de opgave-tekst,
   - link naar de raw screenshot (`open <pad>` werkt op macOS),
   - de solver-pogingen,
   - invulveld voor het juiste antwoord (of "accept solver A/B").

6. **Persistent cache:** Ralphs bevestigingen worden opgeslagen in `content/<editie>/trainers/wiskunde/verified-answers.json` met `verifiedBy: "ralph"` en datum. Volgende pipeline-run skipt deze.

**Velden op trainer-content (wiskunde):**

```json
{
  "opgavenummer": "12a",
  "antwoord": "5",
  "acceptedForms": ["x=5", "5"],
  "confidence": 0.96,
  "verifiedBy": "solver" | "ralph",
  "verifiedAt": "2026-06-12T18:30:00Z",
  "solverAttempts": [
    { "answer": "5", "confidence": 0.95 },
    { "answer": "x = 5", "confidence": 0.97 }
  ]
}
```

**Budget:** elke opgave kost ~€0.05-0.10 (twee Opus-calls + tool-execution). 30-50 wiskunde-opgaven per editie = €1.50-5. Volledig in dev-budget — kwaliteit gaat hier ruim boven kosten.

**Validator-koppeling (§6):** voor wiskunde-content valideert §6 of (a) opgave-tekst matcht met raw, (b) `verifiedBy` is gezet (geen onverified antwoord mag deployen), (c) als `verifiedBy: "solver"` dan `confidence ≥ 0.70`. Anders → blokkeren tot Ralph reviewt.

### Stage 3 — Convert naar canoniek trainer-format

Map de geverifieerde extract-data naar de stabiele trainer-formats. **Dit is het contract** waar de trainer-engines op draaien — wijzigingen vereisen SPEC-update + version-bump.

Stable IDs: `<vak>-h<hoofdstuk>-<onderdeel>-<n>` (bv. `frans-h5-vocab-012`). Dedupe op id. Merge met bestaande content (idempotent).

**Per-vak formats:**

- **Frans / Engels (Cat. 1)** — `vocab.json`:
  ```json
  { "id": "frans-h5-vocab-012", "nl": "huis", "vreemd": "maison",
    "context": "...", "hoofdstuk": "5", "acceptedAnswers": ["maison","la maison"],
    "bron": "raw/frans/h5-p47.jpg", "confidence": 0.97 }
  ```
- **Wiskunde (Cat. 2)** — `opgaven.json`:
  ```json
  { "id": "wi-h3p2-12a", "hoofdstuk": "3", "paragraaf": "3.2", "onderdeel": "3.2a",
    "isSynthese": false, "opgavenummer": "12a", "vraag_md": "Los op: $3x+7=22$",
    "afbeelding": "assets/wiskunde/h3-opg12a.png",
    "antwoord": "5", "acceptedForms": ["x=5","5"], "uitleg_md": "...",
    "type": "lineaire vergelijking", "bron": "raw/wiskunde/h3-p84.jpg",
    "confidence": 0.96, "verifiedBy": "solver", "verifiedAt": "..." }
  ```
  (`afbeelding` optioneel — bv. meetkundefiguur bij de opgave.)
- **Biologie / AK / Geschiedenis (Cat. 3)** — gemengd:
  - `samenvatting/<onderwerp>.md` — verplichte lees-fase
  - `flashcards.json` — begrippen/feiten/topografie (Cat. 1 secundair):
    ```json
    { "vak": "aardrijkskunde", "normalisatie": "begrip", "kaarten": [
      { "id": "aardrijkskunde-h6-begrip-007", "vraag": "Hoe heet de warme zeestroom die …?",
        "antwoord": "Golfstroom", "onderdeel": "§6.1 Golfstroom",
        "hoofdstuk": "6", "bron": "raw/aardrijkskunde/aardrijkskunde-h06-p78.jpg", "confidence": 0.95 },
      { "id": "aardrijkskunde-h5-topo-003", "vraag": "Welk land is dit?", "antwoord": "Vietnam",
        "modus": "kaart", "normalisatie": "exact", "onderdeel": "topografie 5.2",
        "afbeelding": "raw/aardrijkskunde/aardrijkskunde-h05-p66-topo.jpg",
        "hoofdstuk": "5", "bron": "raw/aardrijkskunde/aardrijkskunde-h05-p66-topo.jpg", "confidence": 0.98 }
    ] }
    ```
    `modus` default `"typen"` (getypt + genormaliseerd); `"kaart"` = flip met referentie-`afbeelding` (topografie zonder hotspots — de klikbare versie is een latere upgrade).
  - `oefenvragen.json` — open begripsvragen met `modelAntwoord` en `rubric[]`:
    ```json
    { "vak": "aardrijkskunde", "vragen": [
      { "id": "aardrijkskunde-h6-vraag-003",
        "vraag": "Leg uit waarom Noord-Europa milder is dan je op die breedte zou verwachten.",
        "modelAntwoord": "Door de warme Golfstroom + aanlandige (west)wind die de warmte het land in brengt.",
        "rubric": ["noemt de Golfstroom", "noemt de aanlandige/westenwind", "legt het verband warmte→land"],
        "onderdeel": "§6.1 Golfstroom", "hoofdstuk": "6",
        "bron": "raw/aardrijkskunde/aardrijkskunde-h06-p78.jpg", "confidence": 0.9 }
    ] }
    ```
    Tot de LLM-proxy er is: trainer toont deze in flashcard-modus (vraag → `modelAntwoord`, geen autoscore); de `rubric` ligt al vast voor latere LLM-beoordeling.
- **Nederlands / Engels (Cat. 4)** — `teksten/<id>.md` (oefentekst) + `vragen/<id>.json` (meerkeuze + open met `modelAntwoord`).
- **Gelabeld diagram (Cat. 1 met beeld-prompt)** — `<vak>/diagram.json`, een lijst diagrammen:
  ```json
  { "id": "bio-h1-skelet-diagram", "titel": "Schedel",
    "afbeelding": "assets/biologie/schedel.png",
    "regios": [
      { "id": "jukbeen", "shape": "rect", "coords": [120, 210, 60, 40],
        "vraag": "Welk bot is dit?", "antwoord": "jukbeen",
        "acceptedAnswers": ["jukbeen", "os zygomaticum"],
        "bron": "raw/biologie/h1-p9.jpg" }
    ] }
  ```
  Een diagram draait op de **Cat. 1-leerlogica** (typen + Leitner + normalisatie); alleen de *vraag* is een hotspot i.p.v. tekst. Nul subject-specifieke code (P1) — elk nieuw diagram is enkel een JSON-bestand.

> **Cat. 3 / Cat. 4 vereisen `modelAntwoord` per open vraag** — voor validator én voor flashcard-fallback bij budget op (§11).

#### Afbeeldingen & assets

Afbeeldingen (diagrammen, meetkundefiguren, illustraties) leven in `content/<editie>/assets/<vak>/` en **reizen mee met de editie** (P1). Ze worden uit de raw screenshots gesneden — een content-prep-stap (handmatig of in Stage 2). Referenties zijn relatieve paden vanaf de editie-root.

Twee gebruiksvormen:
- **Passief** — optioneel `afbeelding`-veld op elk content-item (wiskunde-opgave met meetkundefiguur, flashcard-voorkant, vraag-context). Renderer toont de afbeelding; geen interactie, geen extra engine.
- **Interactief** — `diagram.json` hierboven: klikbare regio's gevoed door Cat. 1-logica. **Fallback zonder hotspot-werk:** laat `coords` weg en de trainer stelt de labels als gewone Cat. 1-vragen met de afbeelding als referentie ernaast. De klikbare hotspot-versie is een upgrade, geen voorwaarde.

Deploy (Stage 6): assets gaan mee naar Firebase Cloud Storage onder `editions/<editie>/assets/...`; de statische build (GitHub Pages) kan ze ook direct serveren.

### Stage 4 — Validate

Hand-off naar de validator (zie §6 voor strengheid-regels per content-type). Output: `apps/validator/reports/<vak>-validation.md` met pass/fail vlag per vak.

### Stage 5 — Review queue

**Alle review-items komen samen in één markdown-rapport per vak**, opgebouwd uit:
- Stage 1 classify-onzekerheid
- Stage 2 Pass A↔B disagreement of self-critique flag
- Stage 2.5 LOW-confidence wiskunde-solver
- Stage 4 validator missings/hallucinations/mismatches

Ralph runt `npm run review -- --vak=<vak>` of `npm run review -- --all`. CLI loopt per item:
- toont vraag/opgave/woord + raw-bron (`open <pad>` opent screenshot in Preview)
- toont de conflicterende informatie (Pass A vs B, of solver-pogingen, of mismatch)
- biedt acties: **[a]ccept A** / **[b]ccept B** / **[e]dit** (eigen invul) / **[r]eject** (item droppen) / **[s]kip** (voor later)

Bevestigde items worden opgeslagen in `content/<editie>/cache/verified/` met fingerprint + `verifiedBy: "ralph"` + datum. Volgende pipeline-run skipt deze.

> **Stage 6 is geblokkeerd zolang er review-items open staan voor *strikte* content-types** (wiskunde, cat. 1; zie §6 strengheid-tabel). Soft-content mag deployen met openstaande review-items via `--allow-soft-fail` flag.

### Stage 6 — Publish

Goedgekeurde trainer-content wordt **static gepubliceerd**: de JSON/MD in `content/<editie>/trainers/` (+ `assets/`) gaat mee in de web-bundle en wordt geserveerd via GitHub Pages. Geen runtime-database voor content nodig.

- **Versionering per editie**: folder-naam ís de editie; oude edities blijven in de repo als archief. App kiest de nieuwste (te overrulen via app-instellingen).
- **Update = commit + push**: Pages herbouwt; geen half-deployed-state-probleem (een lopende sessie heeft de oude JSON al geladen).

> **Firestore = uitsluitend voortgang, niet content** (besluit 2026-06-03). Content-in-Firestore (atomic per-vak batch, signed-URL-toegang) is alleen nodig als (a) content privé moet — de repo is nu publiek, dus schoolboek-materiaal staat openbaar; bewust geaccepteerd, hosting/privacy lossen we later op — of (b) je content live wilt updaten zonder redeploy. Beide niet urgent → **geparkeerd**.

### Idempotency & caching

Elke stage berekent een **fingerprint** van zijn input:
- Stage 0: SHA256 van bestandsinhoud per screenshot
- Stage 1-2: prompt-versie + input-hash
- Stage 2.5: opgave-tekst-hash
- Stage 5: gehasht ralph-approval blijft permanent gecached

Cache hits skippen LLM-calls volledig. Eén ongewijzigde screenshot in `raw/` triggert niets. Eén nieuwe of vervangen → alleen die file door de pipeline.

Cache live in `content/<editie>/cache/` (`.gitignore`d behalve `verified/`, dat wordt gecommit zodat Ralphs goedkeuringen niet verloren gaan).

### Tooling — Claude Code skill + Node CLI

Eén set prompt-templates in `apps/validator/prompts/`, twee invocaties:

| Invocatie | Wanneer | Voorbeeld |
|---|---|---|
| **Claude Code skill** | Incidenteel, exploratief, prompt-debugging | `/extract-content frans h5` |
| **Node CLI** | Reproduceerbaar, batch, Stijn zelf | `npm run pipeline -- --vak=frans` |

Beide gebruiken dezelfde prompt-templates (zelfde versie) → **geen prompt-drift tussen modi**. Let op: vision-LLM-calls zijn niet-deterministisch, dus "bit-identieke output" is geen garantie. Reproduceerbaarheid komt uit de **fingerprint-cache** (zie *Idempotency & caching*): een ongewijzigde input levert het gecachete, identieke resultaat — een LLM-call wordt alleen opnieuw gedaan als input of prompt-versie wijzigt.

### Confidence-drempels per stage (review-trigger)

| Stage | Drempel | Boven → | Onder → |
|---|---|---|---|
| 1 Classify | 0.85 | Auto-door | Review |
| 2 Extract A↔B | Exacte match per item | Auto-door | Review |
| 2 Self-critique | "geen fouten" | Auto-door | Re-extract |
| 2.5 Math-solver HIGH | ≥0.95 | Auto-door | Zie volgende |
| 2.5 Math-solver MEDIUM | 0.70-0.94 | Auto-door + note | Zie volgende |
| 2.5 Math-solver LOW | <0.70 | — | Review |
| 4 Validate | per type (zie §6) | Deploy | Blokkeren / soft-fail |

### Volgend jaar — reuse (zero code changes)

```bash
# 1. nieuwe editie folder
mkdir -p content/2027-t1/raw/{frans,engels,nederlands,wiskunde,aardrijkskunde,biologie,geschiedenis}

# 2. drop screenshots in juiste folders

# 3. config: kopieer manifest.yaml-template en vul vakken + scope in
cp content/_template/manifest.yaml content/2027-t1/manifest.yaml
# edit content/2027-t1/manifest.yaml

# 4. run pipeline
npm run pipeline -- --editie=2027-t1

# 5. review eventueel
npm run review -- --editie=2027-t1

# 6. deploy
npm run pipeline -- --editie=2027-t1 --stage=6
```

Geen code-aanpassingen, geen nieuwe trainer-engines, geen nieuwe SPEC-secties.

## 5. Trainer-categorieën

Vier generieke trainer-engines, elke met eigen leeralgoritme. Elk vak gebruikt één of meer engines.

### Categorie 1 — Vocabulaire & feitenkennis
**Methode:** **Actief intypen** van het antwoord (geen "weet ik / wist ik niet"-knop). Combinatie van getypte productie + Leitner spaced repetition (5 bakjes), beide richtingen, korte sessies van ~15 min.

**Stap-voor-stap interactie:**
1. Vraag op scherm: bv. *"Vertaal: huis"* (NL→FR) of *"What does 'maison' mean?"* (FR→NL).
2. Stijn typt het antwoord in een tekstveld en drukt Enter.
3. Engine vergelijkt (zie normalisatie hieronder) en geeft directe feedback:
   - **Goed**: groen vinkje + door naar volgende item.
   - **Fout**: rood kruis + correcte antwoord zichtbaar + 2 sec pauze voor mentale registratie.
   - **Bijna goed** (1–2 tekens verschil bij niet-strikte modus): oranje "bijna! je had X getypt, het is Y" — geldt als fout maar minder bestraffend visueel.

**Snelle herhaling van fouten (binnen sessie):**
- Goed antwoord → item uit huidige queue, bakje +1.
- Fout antwoord → item terug naar bakje 1 én **opnieuw aan de beurt na 3 andere items** in dezelfde sessie (i.p.v. pas in de eindronde).
- Als hetzelfde item 2× in 1 sessie fout gaat: extra hint-modus (eerste letter / aantal letters) bij volgende beurt.
- Eindronde sessie: alle items die in deze sessie nog steeds fout staan komen terug tot ze 1× goed zijn.

**Leitner-intervallen:**
| Bakje | Frequentie |
|---|---|
| 1 | Elke sessie |
| 2 | Elke 2 dagen |
| 3 | Elke 4 dagen |
| 4 | Elke 7 dagen |
| 5 | Elke 14 dagen (vrijwel "klaar") |

**Normalisatie / vergelijking** (per vak configureerbaar):
- Altijd: trim whitespace, case-insensitive (`Maison` = `maison`).
- Frans: **accenten strikt vereist** (`été` ≠ `ete`) — maar typo's van 1 teken triggeren "bijna goed".
- Engels/topografie/jaartallen: accenten optioneel, getallen exact.
- Begrippen (bio/AK/gesch): toleranter — losse leestekens negeren, lidwoorden optioneel (`de cel` = `cel`).
- Per vraag mag een lijst `acceptedAnswers: [...]` staan voor synoniemen.

**Mastery-score per vak/onderwerp:** percentage items in bakje 3+, ondergrens per item: minstens 1× goed beantwoord in laatste sessie.

**Beeld-prompt variant (gelabelde diagrammen):** dezelfde leerlogica werkt ook wanneer de vraag een plek op een afbeelding is i.p.v. tekst (skelet-botten, topografie-kaart, celonderdelen). De trainer toont de afbeelding met klikbare hotspots — of, als fallback zonder hotspot-werk, het label als gewone tekstvraag met de afbeelding ernaast. Content-schema: `diagram.json` in §4. Geen aparte engine — puur een render-laag boven Cat. 1.

**Gebruikt door:** Frans (woordjes/vervoegingen), Engels (woordjes), topografie (AK), vaktermen (bio), jaartallen (gesch), gelabelde diagrammen (bio skelet/cel, AK topografie).

### Categorie 2 — Procedureel oefenen (wiskunde) — gefaseerd + pen-en-papier

**Werkwijze in het kort:** Stijn werkt op papier (boek + schrift), de trainer is alleen de **antwoordcontroleur** en **regisseur** van welke opgave nu aan de beurt is. Geen tussenstappen typen, alleen eindantwoorden.

**Stof-structuur per paragraaf:**

Stof wordt opgedeeld in **onderdelen** (concepten). Voorbeeld H3 Lineaire vergelijkingen:
- *3.2a*: oplossen vergelijking 1 variabele
- *3.2b*: substitueren
- *3.2c*: woordprobleem omzetten naar vergelijking
- *3.2d*: synthese (combineert a/b/c)

Synthese-onderdelen worden pas vrijgespeeld als alle individuele onderdelen ✓ zijn.

**Adaptive volgorde binnen een sessie:**

```
Onderdeel 3.2a  [opg 1: ✓] [opg 2: ✓]                    → 2/2  ✓ door
Onderdeel 3.2b  [opg 1: ✗] [opg 2: ✓]                    → 1/2
                [extra 3: ✓] [extra 4: ✓]                 → 3/4  ✓ door
Onderdeel 3.2c  [opg 1: ✓] [opg 2: ✓]                    → 2/2  ✓ door
Onderdeel 3.2d  (synthese unlocked)  [opg 1: …]           …
```

**Algoritme:** trainer pakt voor elk onderdeel **2 random opgaven** uit de pool van dat onderdeel. Resultaat:
| 2/2 | ✓ onderdeel klaar, door naar volgende |
| 1/2 | +2 extra opgaven; bij ≥3/4 → ✓, anders +2 |
| 0/2 | uitleg tonen + +2 extra opgaven; herhaal tot ≥50% over de hele set |

**Per opgave — pen-en-papier loop:**

1. Trainer: *"Maak op papier: §3.2 opgave 12a"* + kleine reminder *"Schrift + pen erbij?"* (alleen 1× per sessie).
2. Stijn werkt op papier.
3. Trainer-veld: *"Wat is je eindantwoord?"* — Stijn typt alleen het antwoord (getal, breuk, expressie).
4. Vergelijking: numeriek tot rounding-tolerantie; voor symbolische antwoorden meerdere `acceptedForms` (`x=5`, `5`, `x = 5`).
5. **Goed** → groen + door.
6. **Fout** → de **solver-gegenereerde uitleg** (`uitleg_md`) tonen in een vouwblok + *"Probeer nu deze vergelijkbare som"* (retry, telt voor mastery). NB: deze uitleg is afgeleid — niet uit het boek (Getal & Ruimte heeft geen uitwerkingen in de leerlingversie) — en valt dus onder dezelfde vertrouwens-eis als het antwoord (`verifiedBy`; bij LOW-confidence mee-reviewen, zie §4).
7. **Fout op retry ook** → extra uitleg + 2 sommen extra op dit onderdeel toevoegen.

**Logica:** opgavenpool gegroepeerd per onderdeel; engine houdt mastery-score per onderdeel bij; sessie eindigt zodra alle in-scope onderdelen ≥ ✓ of tijd om is.

**Gebruikt door:** Wiskunde.

### Categorie 3 — Begrip & verbanden — eerst samenvatting, daarna vragen

**Werkwijze:** een Cat. 3 blok bestaat uit twee fases:

**Fase 1 — Samenvatting lezen (verplicht voor coverage):**
- Trainer toont een door de content-pipeline gegenereerde **samenvatting** (markdown, scrollable, ~300-600 woorden per onderwerp), met de kernbegrippen vetgedrukt en kruisverbanden expliciet ("zie ook: …").
- Onderaan een **"Klaar met lezen"-knop** als coverage-*nudge*: actief zodra Stijn tot ~80% gescrold is, of direct als de tekst in één scherm past, eventueel met een minimale leestijd. Bewust licht — niet fraudebestendig; de mastery uit fase 2 is het echte coverage-signaal.
- Pas dán komt fase 2 beschikbaar.
- Samenvatting is afgeleid uit de raw screenshots; validator controleert dat geen kernbegrip ontbreekt en niets is verzonnen.

**Fase 2 — Open vragen (telt voor mastery):**
- Trainer stelt open vragen ("leg uit waarom…", "wat gebeurt er als…").
- Stijn typt antwoord in eigen woorden.
- LLM (Haiku) beoordeelt met een rubric per vraag (compleetheid, juistheid van kernbegrippen, verbanden) en geeft korte feedback ("Goed: X, Y. Mist: Z. Probeer Z erbij te vertellen.").
- Stijn kan herzien en opnieuw inleveren — hoogste score telt.
- Minimaal **3 vragen per blok** om mastery telbaar te maken.

**Mindmap-view (optioneel, in Voortgang-tab):** toont kruisverbanden tussen onderwerpen, gevoed door de tags in trainer-content.

**Fallback (budget op):** vragen-fase valt terug op flashcard-modus met modelantwoord; samenvatting-fase blijft ongewijzigd (geen LLM nodig om bestaande markdown te tonen).

**Gebruikt door:** Biologie (processen), Aardrijkskunde (systemen), Geschiedenis (oorzaak/gevolg).

### Categorie 4 — Tekst & taalvaardigheid — eerst tekst, daarna vragen

**Werkwijze (twee fases, analoog aan Cat. 3):**

**Fase 1 — Tekst lezen (verplicht voor coverage):**
- Trainer toont de oefentekst (uit raw screenshots, of een door Stijn aangereikte tekst).
- "Klaar met lezen"-knop als coverage-nudge: actief na ~80% scroll, of direct als de tekst in beeld past (zelfde lichte aanpak als Cat. 3 — de vragen zijn het echte coverage-signaal).

**Fase 2 — Vragen (telt voor mastery):**
- Meerkeuze-vragen over hoofdgedachte/structuur/signaalwoorden — geen LLM nodig.
- Open vragen (bv. "vat de hoofdgedachte in 1 zin samen") — LLM-rubric zoals Cat. 3.
- Grammatica via toepassing (zinnen ontleden) i.p.v. regels uit hoofd.

**Fallback (budget op):** open vragen → flashcard-modus met modelantwoord; meerkeuze blijft volledig functioneel.

**Gebruikt door:** Nederlands (primair), Engels (secundair).

### Mapping per vak

Naast leermethode-categorie krijgt elk vak een **moeilijkheidsgraad voor Stijn** (1 = makkelijk, 2 = gemiddeld, 3 = moeilijk). Dit stuurt:
- *Tijdverdeling:* moeilijke vakken krijgen evenredig meer studietijd.
- *Dagtoewijzing:* op gereduceerde dagen alleen makkelijke vakken (cat 1); moeilijke vakken op volle dagen met hoge concentratie-capaciteit.

| Vak | Primaire cat. | Secundaire cat. | Moeilijkheid (Stijn) |
|---|---|---|---|
| Wiskunde | Cat 2 | — | **3 — moeilijk** |
| Frans | Cat 1 | Cat 4 | **3 — moeilijk** |
| Nederlands | Cat 4 | Cat 1 | **3 — moeilijk** |
| Engels | Cat 1 | Cat 4 | 2 — gemiddeld |
| Geschiedenis | Cat 3 | Cat 1 | 2 — gemiddeld |
| Biologie | Cat 3 | Cat 1 | 1 — makkelijk |
| Aardrijkskunde | Cat 3 | Cat 1 | 1 — makkelijk |

**Implicatie van deze verdeling:** drie zware vakken (Wi/Fr/Nl), twee gemiddelde, twee lichte. De drie zware vakken nemen disproportioneel veel studietijd en moeten op volle dagen staan met hoge concentratie-momenten (eerste blok na avondeten is meestal sterkste).

## 6. Validator-agent (P3)

**Doel:** garanderen dat elke trainer-item terug te voeren is op de ruwe screenshots én dat geen feit uit de screenshots ontbreekt.

**Flow:**
1. Voor elk bestand in `content/2026-t3/trainers/<vak>/`: trek alle "feiten" (woordpaar, opgave, begrip, …) eruit.
2. Voor elk corresponderend bestand in `content/2026-t3/raw/<vak>/`: laat een vision-model alle "feiten" extraheren.
3. Vergelijk beide sets:
   - **Missing:** in raw, niet in trainer → rapport.
   - **Hallucinated:** in trainer, niet in raw → rapport.
   - **Mismatch:** zelfde sleutel, andere waarde (bijv. verkeerde vertaling) → rapport.
4. Output: `validation-report.md` per vak, plus een pass/fail vlag.

**Wanneer draaien:** elke keer als raw of trainer-content verandert (CI-hook of `npm run validate`).

**Budget:** validator-calls zijn `purpose: "development"` en tellen dus niet mee voor de runtime-pot (zie §11).

### Strengheid per content-type (hybride)

| Content-type | Modus | Drempel | Reden |
|---|---|---|---|
| Wiskunde-opgaven (Cat 2) | **Strikt + verified** | 0% afwijking opgave-tekst; `verifiedBy` verplicht aanwezig; solver-confidence ≥ 0.70 anders Ralph-review (zie §4) | Klein, exact, gevaarlijk bij fout — verkeerd antwoord traint verkeerde reflex |
| Cat. 1 flashcards (woordjes, topografie, jaartallen, vaktermen) | **Strikt** | 0% missing/hallucinated; **mismatch → warning** | Stijn leert exact wat erin staat — woord-mismatch (`la maison` vs `maison`) als warning loggen, niet blokkeren |
| Cat. 3 begripsvragen + rubrics | **Soft** | ≤ 10% afwijking toegestaan | Rubric-formulering is subjectief; volledig blokkeren is contraproductief |
| Cat. 4 tekstvragen | **Soft** | ≤ 10% afwijking toegestaan | Idem — vraagstijl-variatie is normaal |

**Workflow:**
- Strikt-content met fail → trainer-content niet gepubliceerd, validator-rapport open in editor.
- Soft-content boven drempel → blokkeren met override-mogelijkheid (`--allow-soft-fail` flag) als Ralph bewust kiest.
- Mismatch-warnings (strikt) → wel publiceren, rapport committen naar repo voor latere review.

## 7. Planner (P4, P5)

### Invoer

**PWW-rooster (definitief):**

| Datum | Vak(ken) |
|---|---|
| ma 29 juni | Engels |
| di 30 juni | Biologie |
| wo 1 juli | Nederlands |
| do 2 juli | Wiskunde + Aardrijkskunde |
| vr 3 juli | Frans + Geschiedenis |

> **Implicatie voor planner:** vakken later in de week (vooral do/vr met dubbele toetsen) krijgen meer absolute leertijd en moeten in de laatste week vooral op herhalen/automatiseren staan. Vakken vroeg in de week (Engels, Biologie) moeten vóór 22 juni "klaar" zijn omdat er nauwelijks ruimte is om er nog tijdens de PWW-week aan te werken.

**Schoolrooster Stijn:**

| Dag | Lestijden |
|---|---|
| ma | 08:35 – 15:15 |
| di | 08:35 – 15:15 |
| wo | 08:35 – 14:25 |
| do | 08:35 – 14:25 |
| vr | 08:35 – 14:25 |

> **Implicatie voor planner:** Stijn is thuis tegen ~15:30 (ma/di) of ~14:45 (wo/do/vr). Dat geeft op alle dagen ruim studieblokken-mogelijkheid in de middag plus na het avondeten.

**Thuiscontext & dagroutine:**

- Geen vaste sport/hobby-verplichtingen.
- Stijn wil eerst **afschakelen na school** — geen studieblok direct na thuiskomst.
- Avondeten doorgaans tussen **18:00 en 20:00**.
- Bedtijd **22:00**.
- Routine: **vaste momenten** elke dag, geen wisselende tijden.
- **Naast PWW-leren is er 30 min regulier huiswerk per schooldag** dat expliciet ingepland moet worden.

**Studiebudget:**

| Periode | Max studietijd | Verdeling |
|---|---|---|
| Doordeweeks (ma–vr) | 1u30 PWW + 0u30 huiswerk = 2u totaal | 1 sessie vóór avondeten + 1 sessie na avondeten |
| Weekend (za–zo) | Max 2u per dag | Verspreid over de dag, in blokken van 15–30 min |
| Gereduceerde dagen | ~45 min | **Twee vaste dagen: woensdag + zaterdag.** Alleen makkelijke vakken (Bio, AK) en alleen Cat. 1-activiteiten (flashcards). Lage cognitieve belasting. |

**Vaste sessietijden doordeweeks (ma, di, do, vr):**

```
15:15  thuis (ma/di) / 14:25 (wo/do/vr)
       ── afschakelen ──
17:00  Sessie 1 (45 min): 30 min huiswerk + 15 min PWW (cat. 1)
17:45  ── vrij / eten ──
20:00  Sessie 2 (60 min): 2× 25 min PWW + 5 min pauze
21:00  ── klaar voor de dag ──
22:00  bed
```

**Woensdag (gereduceerd):** flexibel afhankelijk van de stof — soms één blok van 30 min, soms 2× 15 min, altijd alleen Cat. 1-activiteiten (Bio/AK). Default: één blok in het sessie-2 slot (20:00–20:30).

**Zaterdag (gereduceerd):** ~30–45 min op een door Stijn gekozen moment overdag, alleen Cat. 1-activiteiten.

**Zondag (vol):** volledig schema, maar verdeeld over de dag (geen avondrestrictie van schoolslaap). Voorgesteld: ochtend (10:00) + middag (15:00) + (optioneel) avond (20:00), telkens 30 min.

**Laatste week vóór PWW (22–26 juni) — herhaal-modus:**

Geen huiswerk meer; sessie 1 wordt dus vrijgemaakt voor PWW. Budget blijft 1.5u totaal:

```
17:00  Sessie 1 (30 min): herhaling Cat. 1 (flashcards, alle vakken die nodig zijn)
17:30  ── vrij / eten ──
20:00  Sessie 2 (60 min): 2× 25 min PWW herhaling/mock-toets + 5 min pauze
21:00  ── klaar ──
```

Activiteit deze week is primair Cat. 1 + Cat. 2 (sommen-automatisering). Cat. 3/4 alleen nog "review-passes" op zwakke onderwerpen.

**Blok-regels:** max 30 min per blok (cat. 1 mag 15 min), 5 min pauze tussen blokken, na 2 blokken 15 min pauze.

### Algoritme (schets) — incrementeel & re-runbaar

De planner is een **pure functie** van (vak-content die nú `compleet` is + manifest-datums + Stijns rooster/voorkeurstijden + gemeten voortgang) en wordt **opnieuw gedraaid** telkens als content binnenkomt of voortgang verandert — geen vastgevroren one-shot plan. **Tijdslots liggen vast** (Stijns routine, P4); alleen de *invulling* van de slots herbalanceert, zodat het "Vandaag"-scherm voorspelbaar blijft.

1. **Backward planning vanaf PWW.** De laatste week (22–26 juni) is **gereserveerde buffer** voor herhalen/automatiseren — én vangnet voor uitloop van de eerste ronde.
2. **Eerste leerronde** loopt ma 8 juni t/m zo 21 juni.
3. **Alleen complete vakken worden ingepland.** Een nog niet compleet vak (scope < 100% gedekt/gevalideerd, P8) verschijnt als **"leer uit boek"-placeholder**, niet als trainer-blok. Wordt het vak compleet → de volgende run vouwt het in.
4. **Studietijd-schatting per vak**: hoeveelheid trainer-content × categorie-coëfficiënt (cat 1 sneller per item dan cat 3). Schatting kan pas zodra content bestaat; tot dan provisorisch.
5. **Spaced repetition**: elk onderwerp komt minimaal 3× terug, verspreid. Een onderdeel dat niet ✓ wordt afgerond (`deels`) keert terug op een **later, gespreid** moment — niet meteen — en telt mee tegen de capaciteit.
6. **Dagblok-opbouw**: max 3 blokken per dag, afwisselend vak/categorie tegen sleur. Pauzes (5 min) tussen blokken, na 2 blokken 15 min.

### Pacing & capaciteit — "haal ik het?"

De daglimiet ligt vast (P4: max 1.5u PWW/dag). Werk dat niet past, móét ergens heen — daarom maakt de planner capaciteits-overflow **zichtbaar** i.p.v. stil de dag vol te proppen of content stil te laten vallen.

- **Verwacht tempo** = totaal geschat werk / beschikbare slots vóór de deadline.
- **Werkelijk tempo** = gemeten uit afgeronde blokken (behaalde mastery/coverage per slot; hoe vaak blokken als `deels` terugkeren).
- **Projectie**: past het resterende werk bij het huidige tempo nog in de resterende slots vóór (a) elke vak-toets en (b) de start van de buffer-week?

**Flags (naar admin/Ralph; subtiel naar Stijn):**
- ⚠️ **Achterstand** — Stijn gaat langzamer dan geschat → resterend werk past niet → *"overweeg extra timeslots, extra dagen, of meer per dag."* Ralph beslist (slots horen bij de routine die Ralph/Stijn instellen).
- ⚠️ **Buffer-aanvreten** — als de eerste ronde uitloopt in de herhaal-week (22–26 juni) gaat dat ten koste van herhaling/automatisering → signaal om scope of tempo bij te stellen.
- ⚠️ **Te late content** — een vak dat zó laat compleet wordt dat eerste ronde + 3× spreiding niet meer vóór z'n toets passen. Vooral **Engels** (toets ma 29/6, nu nog nul screenshots).

De planner lost overflow dus niet zelf op (geen stille scope-drop, geen overvolle dagen); hij maakt 'm expliciet en laat de keuze — méér tijd vs. minder scope — aan Ralph/Stijn.

### Output: dagweergave (Vandaag-scherm — app opent hierop)

```
┌────────────────────────────────────────────────┐
│ 🔥 4 dagen · 215 pt                            │
│ Volgende mijlpaal: Zilver (nog 85 pt)          │
│ Vandaag: 1/3 ✓                                 │
└────────────────────────────────────────────────┘

Dinsdag 10 juni — 1u15 PWW + 30 min HW
┌────────────────────────────────────────────────┐
│ 17:00  Huiswerk (30 min)                  ○   │
│ 17:30  Frans woordjes Hfst 5 (15 min) [cat1]   │
│        ▶ START                            ○    │
│ 17:45  ── eten ──                              │
│ 20:00  Wiskunde §3.2 lin. verg. (25 min) [cat2]│
│        ▶ START                            ✓    │
│ 20:30  Biologie celdeling (25 min)       [cat3]│
│        ▶ START                            ◐    │
└────────────────────────────────────────────────┘
   ↑ tap "START" → opent trainer met juiste content geladen

Legenda:  ○ open   ▶ bezig   ◐ deels (komt terug)   ✓ afgevinkt
```

**Mini-progress widget bovenaan** is altijd zichtbaar (sticky bij scrollen). Toont:
- 🔥 huidige streak in dagen
- huidig puntentotaal
- volgende mijlpaal + resterende punten
- vandaag-voortgang `<voltooid>/<totaal> ✓`

### Blok-data-model

Elke planner-blok is een object met daarin alle informatie die de trainer nodig heeft om direct te beginnen:

```typescript
type Blok = {
  id: string;                    // bv. "2026-06-10-blok-2"
  datum: string;                 // ISO date
  starttijd: string;             // "17:30"
  duurMinuten: 15 | 25 | 30;
  type: "pww" | "huiswerk" | "pauze";
  vak?: Vak;                     // bij pww
  categorie?: 1 | 2 | 3 | 4;     // bij pww — bepaalt welke trainer-engine
  onderwerpen?: string[];        // filter op trainer-content, bv. ["hfst5-woordjes"]
  trainerDeeplink?: string;      // bv. "/trainer/frans/cat1?onderwerp=hfst5-woordjes&blok=..."
  status: "open" | "bezig" | "deels" | "afgevinkt" | "overgeslagen";
  // resultaat (na sessie)
  coverage?: number;             // 0-1, criterium-specifiek per cat (zie §8)
  mastery?: number;              // 0-1, criterium-specifiek per cat
  afgevinkt?: boolean;           // true wanneer beide drempels gehaald
};
```

> Een blok dat tijd-op is maar niet `afgevinkt` krijgt status `deels` en wordt door de planner-engine **opnieuw ingepland** in een volgend blok (zelfde vak/onderwerp, hoogste prioriteit). Pas bij `afgevinkt: true` is het echt klaar.

### Direct linken: planner → trainer

- **App opent default op `/vandaag`** (geen tussenstap, geen menu).
- Elk blok heeft een prominente **START-knop** die naar `trainerDeeplink` navigeert.
- De trainer ontvangt blok-id en filtert de content-pool meteen op de geconfigureerde `onderwerpen` — geen "kies hoofdstuk"-scherm tussen.
- Trainer kent `duurMinuten` en toont een **subtiel timer-balkje**. Bij 90% van de tijd → "Nog ~3 min, ronde afsluiten?". Bij 100% → afronding-modal met sessie-resultaat en knop "terug naar Vandaag".
- Bij terugkeer naar `/vandaag` is het blok automatisch op `klaar` (mastery vastgelegd op blok-id) en zit Stijn klaar voor het volgende blok.

### Voortgang (`/voortgang` — apart scherm)

- Per vak een rij: **% klaar voor PWW** (geaggregeerde mastery) + sparkline van laatste 7 dagen.
- Per onderwerp: bakje-verdeling (Cat. 1) of mastery-percentage (Cat. 2/3/4), rood/oranje/groen.
- Per blok-historie: wanneer gedaan, hoeveel items, score.
- Filter "toon alleen rood" → snel zien wat extra aandacht nodig heeft.

### Navigatie

- **Bottom-nav (mobile) / sidebar (desktop)** met 3 items:
  1. **Vandaag** (default)
  2. **Voortgang**
  3. **Mijn instellingen** (rooster, voorkeuren, beloningen — voor Ralph: admin-tab)

## 8. Beloningssysteem & gamification

**Doel:** intrinsieke motivatie ondersteunen met gemeten voortgang, gekoppeld aan externe beloningen die de ouder configureert (ijsje, extra zakgeld, nieuwe game, etc.).

> **Bouwvolgorde (besluit 2026-06-03):** de **gamification-laag** (punten, streaks, mijlpalen, ouder-beloningen) is **fase-2** — niet nodig voor correct/volledig leren (P8). Wél v0.1-core: het **afvink-criterium per blok** (coverage + mastery, tabel hieronder), want de planner en "Vandaag" hebben `afgevinkt`/`deels` nodig voor re-planning. **Trainers worden mét de motivatie-laag in gedachten gebouwd:** elke trainer emit een gestructureerd blok-resultaat (coverage, mastery, ✓-status, timestamp) dat **append-only** wordt gelogd vanaf v0.1. De gamification-laag is later een **pure afgeleide view** over dat log — geen trainer hoeft punten te kennen, en er gaat geen historie verloren als beloningen pas later aangaan.

### Principes

1. **Beloon kwaliteit, niet alleen aanwezigheid.** Punten komen vooral uit gemeten mastery (trainer-scores), niet uit "tijd in stoel". Anders ontstaat de prikkel om snel weg te klikken.
2. **Beloon consistentie.** Streaks (X dagen op rij volgens plan) leveren bonuspunten. Een gemiste dag breekt de streak niet onmiddellijk (1 "freebie" per week) — geen straf-mechanisme voor een zieke of drukke dag.
3. **Transparant.** Stijn ziet realtime hoeveel punten hij heeft, welke beloning de volgende mijlpaal is, en hoe ver hij nog moet.
4. **Ouder configureert beloningen, kind ziet alleen mijlpalen.** Belonings-bedrag/object is door ouder in te stellen (niet door kind te wijzigen).

### Afvink-criterium per blok (✓) — v0.1-core

Een blok is **✓ afgevinkt** als **beide** criteria gehaald zijn. Coverage en mastery zijn cat-specifiek:

| Cat | Coverage = | Mastery = | Mastery drempel |
|---|---|---|---|
| **Cat. 1** (woordjes, feiten) | Elk in-scope item ≥ 1× getoond | % items minstens 1× goed beantwoord in deze sessie | **80%** |
| **Cat. 2** (wiskunde) | Elk onderdeel in scope ≥ 2 opgaven gepoogd | % onderdelen ✓ (2/2 of ≥3/4 na extra opgaven) | **70%** |
| **Cat. 3** (begrip) | **Samenvatting gelezen** (klaar-knop na ~80% scroll) | Gem. rubric-score op de open vragen (min. 3 vragen beantwoord) | **60%** |
| **Cat. 4** (tekst) | **Tekst gelezen** (klaar-knop) | % meerkeuze correct + gem. rubric op open vragen | **70%** |

> Verschil per cat is bewust: Cat. 1 woordjes moet je gewoon kennen (strikt), Cat. 3 begrip is een graduele schaal (toleranter).

Een blok dat de tijd haalt maar niet ✓ wordt **automatisch opnieuw ingepland** in een volgend blok (zie §7 blok-data-model `status: "deels"`).

### Puntensysteem

Punten zijn gekoppeld aan de ✓-status, niet aan blote "tijd in stoel":

| Resultaat | Punten | Effect in UI |
|---|---|---|
| Blok ✓ + mastery ≥ 90% (uitmuntend) | **15** | groene vink + ★ |
| Blok ✓ (mastery van drempel t/m 89%) | **10** | groene vink |
| Geprobeerd, niet ✓ (deels) | **2** | half vinkje, blok keert terug |
| Dagdoel gehaald (alle blokken ✓ vandaag) | +15 | confetti-burst (1×/dag) |
| Weekstreak (7 dagen plan gehaald, rustdagen tellen mee, 1 freebie/week) | +50 | 🔥-icoon zichtbaar |
| Vak "klaar voor PWW" (alle onderwerpen ≥ mastery-drempel) | +75 | vak-rij wordt groen op /voortgang |

> Per onderwerp telt het hoogste behaalde mastery-niveau, niet de optelsom van pogingen — opnieuw doen voor extra punten heeft geen zin (anti-grinding). Het "niet ✓ → 2 punten + retry" pad ondervangt fairness: deelname wordt erkend, maar pas bij ✓ telt het echt.

### Mijlpalen & beloningen

Ouder definieert mijlpalen in app-instellingen, bijv:

| Mijlpaal | Punten | Voorbeeld externe beloning (door ouder ingevuld) |
|---|---|---|
| Brons | 100 | "IJsje na het avondeten" |
| Zilver | 300 | "Zaterdagavond bowlen met een vriend" |
| Goud | 600 | "€15 extra zakgeld" |
| Platina | 1000 | "Concertje / dagje uit naar keuze" |

App toont aan Stijn: huidige punten, balkje naar volgende mijlpaal, "X dagen tot PWW". Ouder krijgt een notificatie/email als een mijlpaal bereikt is.

### Data-model (schets)

```
progress/<user-id>/
├── blok-resultaten.jsonl  # v0.1-core, append-only: blokId, vak, categorie, coverage, mastery, afgevinkt, timestamp
├── points-log.jsonl       # fase-2, afgeleid: timestamp, actie, punten, reden
├── milestones.json        # fase-2: geclaimde + nog niet geclaimde
└── rewards-config.json    # fase-2: ouder-instellingen
```

> `blok-resultaten.jsonl` is de bron-van-waarheid die de trainers vanaf v0.1 schrijven; `points-log` en mijlpalen zijn er later een **pure functie** over (retroactief berekenbaar over de volledige historie).

## 9. Multi-user (P6)

- **Verwachte schaal:** halve klas, ~10–15 gebruikers.
- **Toegang:** **open link, geen auth** (besluit 2026-06-03). Bij eerste gebruik vul je je **naam** in; die naam (geslugd) is je identiteit én de Firestore-document-sleutel. Geen wachtwoord, geen e-mail, geen account-flow. Dezelfde naam op een ander apparaat = dezelfde voortgang — zo werkt cross-device sync. Gevolg: de Firestore-DB staat feitelijk open en namen kunnen botsen — **bewust geaccepteerd** voor deze schaal (Stijn + klasgenoten, één editie). Een echte auth-laag is de nette upgrade als hier ooit een product van wordt.
- **Content-eigendom:** **één gedeelde content-set** (Stijns boeken/screenshots), beheerd door Ralph. Klasgenoten gebruiken dezelfde trainers — zij kunnen geen content uploaden of wijzigen (in v1).
- **Per gebruiker eigen:**
  - Naam-gebaseerde identiteit (geen wachtwoord)
  - Planner (eigen thuiscontext, eigen rooster, eigen voorkeurstijden)
  - Voortgang & mastery
  - Punten & beloningen (eigen ouder-beloningen, of een default-set voor gebruikers zonder configurerende ouder)
- **Geen sociaal vergelijken** in v1 (geen leaderboard) — focus op individueel leren, druk laag.

**Aandachtspunten bij open-link:**
- Stijn moet de URL niet op social media zetten — alleen rechtstreeks delen.
- Naam-veld kan flauwekul-input bevatten (geen verificatie). Acceptabel voor deze schaal.
- LLM-kosten per gebruiker (Cat 3/4 beoordeling) lopen op — quota per account nodig? Zie §11 open punten.

## 10. UI / UX (P7)

- **Mobile-first** maar volledig responsive richting desktop.
- **App opent default op `/vandaag`** — geen tussenstap, geen menu. Doel: van scherm-aan tot oefenen in 1 tap.
- **Drie primaire schermen** (bottom-nav op mobile, sidebar op desktop):
  1. **Vandaag** (default) — dagweergave met blokken, prominente START-knop per blok die direct in de juiste trainer + content opent (zie §7).
  2. **Voortgang** — per vak een rij, % klaar, welke onderwerpen rood/oranje/groen.
  3. **Instellingen** — rooster, voorkeuren, beloningen.
- **Trainerscherm per categorie:**
  - **Cat. 1**: tekstveld voor typen, grote feedback (groen/rood/oranje), hint-modus bij herhaalde fouten. Bij accent-talen (Frans) een **accent-helper-rij** (tikbare é è ç à ù) boven het veld — ergonomisch op mobiel, zonder de strikte accent-check los te laten.
  - **Cat. 2**: opgave-titel + reminder "pen + schrift erbij?", invulveld voor **alleen eindantwoord** + boek-uitwerking in vouwblok bij fout. Onderdeel-progressie zichtbaar als kralenketting (●●○○).
  - **Cat. 3**: twee-fase scherm — **Lees-fase** (samenvatting in markdown, "Klaar met lezen"-knop ontgrendelt na ~80% scroll) → **Vraag-fase** (textarea + AI-rubric óf flashcard-fallback).
  - **Cat. 4**: idem als Cat. 3 maar lees-fase toont oefentekst i.p.v. samenvatting; vragen-fase mengt meerkeuze (geen LLM) en open vragen (LLM-rubric / fallback).
- **Subtiel timer-balkje** per sessie (geen wegtellende klok in beeld — alleen markering bij 90% en einde).
- **Afronding-modal** toont: ✓ of ◐, behaalde mastery, behaalde punten, knop "terug naar Vandaag".
- **Lage cognitive load:** weinig kleuren, duidelijke knoppen, geen afleidende notificaties.
- **Beloning zichtbaar maar subtiel:** punten-balkje op Vandaag-scherm, niet dominant.
- **Tech:** React + Vite + Tailwind + shadcn/ui (zie §11).

## 11. Tech stack

| Laag | Keuze | Reden |
|---|---|---|
| Frontend | **React + Vite + TypeScript + Tailwind** | Statisch builden voor GitHub Pages, brede community, makkelijke AI-coding |
| UI-componenten | **shadcn/ui** (radix + tailwind) | Mobile-first, toegankelijk, copy-paste model past bij static SPA |
| State | **Zustand** (lokaal) + Firestore listeners (server-sync) | Simpel, voldoende voor deze schaal |
| Auth | **Geen** (v0.1) — naam-gebaseerde identiteit, naam = Firestore-doc-sleutel | Low-threshold: "naam invullen en klaar". Firebase Auth is de latere upgrade (zie §9) |
| Database | **Firestore** (alleen voortgang) | Real-time cross-device sync; gratis tier ruim voldoende. v0.1 zonder auth → open rules (bewust, zie §9) |
| Bestandsopslag (screenshots) | **Firebase Cloud Storage** | Beheerd door Ralph, klasgenoten alleen-lezen via signed URLs |
| Serverless functies (LLM-proxy) | **Firebase Cloud Functions (Node.js)** | Anthropic API-sleutel server-side, rate limiting per user |
| LLM voor beoordeling Cat 3/4 | **Claude Haiku 4.5** (snel + goedkoop) | Past in €100/maand-budget bij ~15 users |
| LLM voor content-extractie + validator | **Claude Opus 4.8** (vision) | Eenmalig per content-update, kwaliteit boven kosten |
| Hosting frontend | **GitHub Pages** (vanuit `apps/web/dist`) | Gratis, ingebouwde CI via Actions |
| Domein | `<repo>.github.io/pww` (geen custom domein) | Geen voorkeur opgegeven |
| Budget | **Runtime: €100/maand cap. Development: ongelimiteerd (warn-only).** | Twee gescheiden potten — zie subsectie *Budget — twee gescheiden potten* hieronder |

> **Bouwvolgorde (besluit 2026-06-03):** v0.1 zet alleen **Firestore** in (zónder auth — naam-gebaseerde identiteit, zie §9) voor cross-device voortgang-sync (dealbreaker). **Firebase Auth, Cloud Functions (LLM-proxy), Cloud Storage en de budget-/quota-machinerie zijn uitgesteld** tot ze nodig zijn; tot die tijd draaien Cat 3/4 in flashcard-modus zonder LLM. Content wordt static geserveerd via GitHub Pages (zie §4 Stage 6), niet uit Firestore.

### Consequenties van GitHub Pages + Firebase

- **Geen server-side rendering** — volledige SPA.
- **Alle dynamische routes via Firestore + Cloud Functions** — geen Next.js API-routes.
- **Anthropic-API key staat alleen in Cloud Functions**, nooit in frontend bundle.
- **Routing via hash-based router** (`#/vandaag`) of `BrowserRouter` met fallback `404.html` (GitHub Pages SPA-trick).
- **Validator (apps/validator)** draait als losse Node-CLI lokaal bij Ralph, niet in productie. Output committen naar repo. Productie-app trust de gevalideerde JSON.

### Budget — twee gescheiden potten

Het budget is opgesplitst in **runtime** (productie-app, gebruikers) en **development** (content-pipeline, validator, prompt-iteratie). Iedere LLM-call krijgt een `purpose`-tag (`"runtime"` of `"development"`) en wordt apart geboekt in Firestore (`usage/runtime/<month>` resp. `usage/development/<month>`).

| Pot | Voor wat | Cap | Bij overschrijding |
|---|---|---|---|
| **Runtime** | Cat. 3/4 antwoordbeoordeling, eventuele live hints | **€100/maand hard cap** (soft warn €80) | Graceful degradation naar flashcard-modus |
| **Development** | Content-pipeline (classify / extract / critique), validator (P3), admin-tools, prompt-iteratie | **Ongelimiteerd** | Alleen waarschuwingen, geen blokkering |

> **Belangrijk:** content-extractie en validatie tellen **nooit** mee voor de runtime-pot. De pijplijn die screenshots verwerkt mag duur zijn — kwaliteit gaat boven kosten, eenmalig per editie.

### Runtime-budget — quota-verdeling (Stijn-voorrang) + graceful degradation

Stijn is de primaire gebruiker en krijgt voorrang. Klasgenoten delen de resterende pot.

| Gebruiker | Soft cap (/maand) | Hard cap (/maand) |
|---|---|---|
| **Stijn** | €40 | €60 |
| Klasgenoot (× ~14) | €3 | €5 |
| Globaal | €80 | €100 |

**Gedrag bij cap-overschrijding — geen errors, wel feature-degradation:**

- **Onder soft cap:** normale werking, alle LLM-features actief.
- **Tussen soft en hard cap:** waarschuwing op admin-dashboard (Ralph), eindgebruiker merkt niets.
- **Boven hard cap (per-user of globaal):** Cat. 3 en Cat. 4 vragen vallen automatisch terug op **flashcard-modus**:
  - Vraag op de voorkant.
  - Modelantwoord (geëxtraheerd uit de raw screenshots tijdens content-build) op de achterkant.
  - User zelf-beoordeelt ("Wist ik" / "Wist ik niet"), zoals Cat. 1.
  - Subtiele indicator in UI: *"Vandaag zonder AI-feedback — antwoorden zelf checken"*.
  - Mastery-score blijft draaien op self-report (lager gewogen dan AI-beoordeling).

**Implicaties:**
- Elke Cat. 3/4-vraag MOET een `modelAntwoord`-veld hebben in de trainer-content (al onderdeel van de pipeline omdat validator dit nodig heeft).
- Cap-overschrijding is dus geen blokkade, alleen kwaliteitsvermindering.
- App blijft 100% bruikbaar, ook bij globaal uitgeput budget.
- Cat. 1 trainers gebruiken sowieso geen LLM — onaangetast.
- Cat. 2 (wiskunde) gebruikt geen LLM voor beoordeling (exacte numerieke check) — onaangetast.

Cloud Function checkt bij elke LLM-call eerst de huidige usage in Firestore (`usage/<user-id>/current-month.json`) en retourneert bij overschrijding een `{ "mode": "flashcard-fallback" }` response in plaats van een error. Frontend rendert dan flashcard-view.

### Development-budget — waarschuwingsdrempels (geen cap)

Het ontwikkelbudget is ongelimiteerd, maar als het buiten proportie raakt wil Ralph een seintje. Een normale PWW-content-extractie (7 vakken × ~5 screenshots × multi-pass Opus + validator) kost rond de **€5–15 per editie**. Drempels voor waarschuwing:

| Niveau | Drempel | Reden voor waarschuwing |
|---|---|---|
| Per pipeline-run (één `npm run extract …`) | **€25** | ≥3× verwachte kosten — waarschijnlijk retry-storm, looping agent, of per ongeluk dubbele/grote input |
| Per dag totaal (development-pot) | **€50** | Normaal alleen bij stevige prompt-iteratie; daarboven check waarom |
| Per maand totaal (development-pot) | **€150** | Een hele extra editie + flink itereren past hier nog onder; daarboven is iets structureel mis |

Waarschuwingen:
- E-mail naar `ralph.holdorp@gmail.com`
- Banner op admin-dashboard
- **Geen automatische blokkering** — Ralph beslist of hij doorgaat

### Runtime budget-monitoring

Cloud Function logt elke runtime-LLM-call met cost-estimate naar `usage/runtime/<month>` in Firestore. Per dag-job aggregeert totalen en pusht naar admin-dashboard:
- **Soft cap €80** (runtime/maand): waarschuwing voor Ralph.
- **Hard cap €100** (runtime/maand): cat. 3/4 calls vallen terug op flashcard-modus (zie kwota-tabel hierboven).

## 12. Open punten — eerstvolgende iteratie

> **Status:** alle architectuur-, planning-, trainer-, beloning-, content-pipeline- en budget-vragen zijn beantwoord. Resterende Ralph-inputs: externe beloningen (via admin-UI, niet blokkerend) en de **scope-checklist per vak**. Die laatste is **completeness-kritisch** (P8): een vak kan niet als compleet/vertrouwd live zonder volledige scope (zie §4 completeness-gate). Wordt vastgelegd in de sessie met Stijn op **do 2026-06-04** — dan komen ook alle resterende screenshots binnen.

Deze moeten we de komende iteraties oplossen voordat we kunnen bouwen:

- [x] ~~Exact PWW-rooster~~ (zie §7, definitief: 29 juni t/m 3 juli)
- [x] ~~Schoolrooster Stijn~~ (zie §7)
- [x] ~~Thuiscontext / voorkeurstijden~~ (zie §7: routine, 2 sessies/dag, huiswerk meegenomen)
- [x] ~~Rustdag-model~~ (2 gereduceerde dagen, zaterdag vast; **tweede dag nog te bepalen**)
- [x] ~~Tweede gereduceerde dag~~ (woensdag)
- [x] ~~Moeilijkheidsgraad~~ (Engels 2, Nederlands 3, Geschiedenis 2)
- [x] ~~Exacte tijdslots~~ (sessie 1: 17:00–17:45, sessie 2: 20:00–21:00; woensdag flexibel)
- [x] ~~Huiswerk in laatste week~~ (bevestigd: geen, sessie 1 → 30 min herhaling)
- [x] ~~Beloningssysteem~~ (punten-ratio's + mijlpalen 100/300/600/1000 akkoord — zie §8)
- [x] ~~Streak-freebies~~ (1 gemiste dag per week akkoord)
- [ ] **Externe beloningen invullen** (Ralph: koppel concrete beloningen aan brons/zilver/goud/platina in de app)
- [x] ~~Multi-user scope~~ (halve klas ~10–15, open link, gedeelde content)
- [x] ~~Hosting & budget~~ (GitHub Pages + Firebase, €100/maand cap)
- [x] ~~LLM-quota per gebruiker~~ (Stijn-voorrang: €40 soft / €60 hard; klasgenoten €3/€5 — zie §11)
- [x] ~~Wiskunde-methode~~ (Getal & Ruimte)
- [ ] **Per vak: scope-checklist** (hoofdstukken/§/woordenlijsten) — **completeness-kritisch, NIET deferred** (zie §4 completeness-gate + P8). Zonder volledige scope kan een vak niet als compleet/vertrouwd live. Komt van Stijn/docent; vastleggen in sessie do 2026-06-04.
- [x] ~~Validatie-strengheid~~ (hybride: strikt voor wiskunde + cat. 1, soft ≤10% voor cat. 3/4 — zie §6)
- [x] ~~Tech-stack definitief~~ (React+Vite, Firestore, Firebase Auth, Cloud Functions, Claude Haiku/Opus — zie §11)
