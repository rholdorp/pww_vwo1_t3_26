# Proefwerkweek Trainer & Planner — Specificatie

**Doelgebruiker (initieel):** Stijn, klas 1 Atheneum, trimester 3 proefwerkweek 2026
**Status:** Concept / in iteratie
**Laatste update:** 2026-06-02

---

## 1. Doel

Een webapp die scholieren helpt om zich gericht en in haalbare stukjes voor te bereiden op hun proefwerkweek. De app bestaat uit twee samenhangende onderdelen:

1. **Planner met voortgang** — een dag-voor-dag studieplan dat rekening houdt met de schooltijden, thuiscontext, aandachtsspanne en het PWW-rooster. De planner laat zien wat vandaag moet gebeuren en houdt voortgang bij.
2. **Trainers per vak** — interactieve oefenmodules die per vakcategorie de juiste leerstrategie toepassen (zie §5). Elke trainer haalt zijn content uit een aparte content-laag, los van de code.

## 2. Kernuitgangspunten

| # | Principe | Consequentie |
|---|---|---|
| P1 | **Content los van code** | Volgend jaar nieuwe screenshots uploaden → nieuwe trainer zonder code wijzigen. Geen subject-specifieke logica hard-coded. |
| P2 | **Ruwe bron is leidend** | Screenshots van fysiek boek/schrift zijn de "source of truth". Trainercontent wordt afgeleid, niet zelfstandig verzonnen. |
| P3 | **Validatie van content** | Een aparte agent vergelijkt de gegenereerde trainercontent met de ruwe screenshots: niets gemist, niets gehallucineerd. |
| P4 | **Korte blokken, lage drempel** | Maximaal 30 min per blok (cat. 1: 15 min), max 1.5 uur per dag, met pauzes. |
| P5 | **Klaar vóór de laatste week** | Eerste leerronde afgerond vóór de week direct vóór de PWW. Die laatste week is alleen herhalen + automatiseren. |
| P6 | **Multi-user / deelbaar** | Klasgenoten kunnen meedoen en hun eigen voortgang bijhouden op dezelfde content. |
| P7 | **Mobile-first responsive** | Bruikbaar op telefoon (avond op de bank) én PC (achter bureau). |

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
│       ├── trainers/             # Afgeleide trainer-content (JSON/YAML)
│       │   ├── frans/
│       │   │   ├── vocab.json    # woordenlijsten
│       │   │   └── zinnen.json
│       │   ├── wiskunde/
│       │   │   └── opgaven.json  # letterlijke opgaven uit boek
│       │   └── ...
│       └── manifest.yaml         # welke vakken, welke hoofdstukken, welke toetsdatums
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

```
[fysiek boek]
     │  foto/screenshot
     ▼
content/2026-t3/raw/<vak>/hoofdstuk-X-pagina-Y.jpg
     │  extractie (OCR/vision model)
     ▼
content/2026-t3/trainers/<vak>/<type>.json
     │  validatie (apps/validator)
     ▼
[goedgekeurde trainer-content] ──► trainer in webapp
```

Per vak verschilt het extractieformaat:

- **Frans/Engels**: `{ "nl": "huis", "fr": "maison", "context": "...", "hoofdstuk": 5 }`
- **Wiskunde** (Getal & Ruimte): `{ "hoofdstuk": "3", "paragraaf": "3.2", "opgavenummer": "12a", "vraag": "...", "antwoord": "...", "uitleg": "...", "type": "lineaire vergelijking" }`
  - Getal & Ruimte structuur: hoofdstuk → paragraaf → opgaven (a/b/c sub-onderdelen). Validator gebruikt `H.P.opgave` als sleutel om raw ↔ trainer te matchen.
- **Biologie/AK/Geschiedenis**: gemengd — `flashcards.json` voor begrippen/feiten + `concepten.json` voor uit te leggen processen + `oefenvragen.json` voor open vragen.

> **Voor elke Cat. 3 / Cat. 4 vraag verplicht:** een `modelAntwoord`-veld met het uitgewerkte goede antwoord (uit de raw screenshots). Dit is nodig voor (1) de validator en (2) de flashcard-fallback wanneer het LLM-budget op is — zie §11.

## 5. Trainer-categorieën

Vier generieke trainer-engines, elke met eigen leeralgoritme. Elk vak gebruikt één of meer engines.

### Categorie 1 — Vocabulaire & feitenkennis
**Methode:** Leitner spaced repetition (5 bakjes), beide richtingen, korte sessies van ~15 min.
**Logica:** fout → bakje 1, goed → één bakje omhoog, bakjes 2..5 op intervallen van 1/3/7/14 dagen. Aan einde sessie: kleine eindronde van fout-beantwoorde kaarten.
**Gebruikt door:** Frans (woordjes/vervoegingen), Engels (woordjes), topografie (AK), vaktermen (bio), jaartallen (gesch).

### Categorie 2 — Procedureel oefenen (wiskunde)
**Methode:** opklimmende moeilijkheid, interleaving van sommen-types, na fout → uitleg + 2 vergelijkbare sommen, tot 3× achter elkaar goed per type. Sluit af met mixed mini-toets.
**Logica:** opgavenpool gegroepeerd per type; engine houdt mastery-score per type bij; pakt volgende opgave op basis van laagste mastery.
**Gebruikt door:** Wiskunde.

### Categorie 3 — Begrip & verbanden
**Methode:** trainer stelt open vragen ("leg uit waarom…", "wat gebeurt er als…"); Stijn typt antwoord in eigen woorden; LLM beoordeelt met een rubric (compleetheid, juistheid van kernbegrippen, verbanden). Mindmap-view voor kruisverbanden.
**Logica:** vragenpool per onderwerp; rubric per vraag opgesteld bij content-extractie; mastery-score per onderwerp.
**Fallback (budget op):** flashcard-modus met modelantwoord op de achterkant, user self-grades.
**Gebruikt door:** Biologie (processen), Aardrijkskunde (systemen), Geschiedenis (oorzaak/gevolg).

### Categorie 4 — Tekst & taalvaardigheid
**Methode:** oefenteksten met meerkeuze + open vragen over hoofdgedachte/structuur/signaalwoorden; grammatica via toepassing (zinnen ontleden) i.p.v. regels uit hoofd.
**Logica:** tekstcorpus + vragenset; LLM-beoordeling op open vragen.
**Fallback (budget op):** flashcard-modus met modelantwoord, user self-grades. Meerkeuze-vragen blijven volledig functioneel (geen LLM nodig).
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

### Strengheid per content-type (hybride)

| Content-type | Modus | Drempel | Reden |
|---|---|---|---|
| Wiskunde-opgaven (Cat 2) | **Strikt** | 0% afwijking | Klein, exact, gevaarlijk bij fout — verkeerd antwoord traint verkeerde reflex |
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

### Algoritme (schets)
1. **Backward planning vanaf PWW.** Reserveer de laatste week (22–28 juni) voor herhalen/automatiseren.
2. **Eerste leerronde** loopt van ma 8 juni t/m zo 21 juni (2 weken).
3. **Per vak**: schat benodigde studietijd op basis van hoeveelheid trainer-content × categorie-coëfficiënt (cat 1 sneller per item dan cat 3).
4. **Verdeel over dagen** met spaced repetition principe: elk onderwerp komt minimaal 3× terug verspreid over de periode.
5. **Dagblok-opbouw**: max 3 blokken per dag, afwisselend vak/categorie om sleur te voorkomen. Pauzes (5 min) tussen blokken, na 2 blokken een langere pauze (15 min).

### Output: dagweergave
```
Dinsdag 10 juni — 1u30 studiebudget
┌─────────────────────────────────────────┐
│ 18:30  Frans woordjes (15 min)    [cat1]│  ✓ klaar
│ 18:50  Wiskunde §3.2 (30 min)     [cat2]│  ▶ bezig
│ 19:25  PAUZE                            │
│ 19:40  Biologie cellen (25 min)   [cat3]│  ○
└─────────────────────────────────────────┘
```

### Voortgang
- Per blok: aangevangen / afgerond / overgeslagen.
- Per onderwerp: mastery-score (uit trainer-engine) als percentage of bakje-verdeling.
- Per vak: "% klaar voor PWW" als geaggregeerde mastery.

## 8. Beloningssysteem & gamification

**Doel:** intrinsieke motivatie ondersteunen met gemeten voortgang, gekoppeld aan externe beloningen die de ouder configureert (ijsje, extra zakgeld, nieuwe game, etc.).

### Principes

1. **Beloon kwaliteit, niet alleen aanwezigheid.** Punten komen vooral uit gemeten mastery (trainer-scores), niet uit "tijd in stoel". Anders ontstaat de prikkel om snel weg te klikken.
2. **Beloon consistentie.** Streaks (X dagen op rij volgens plan) leveren bonuspunten. Een gemiste dag breekt de streak niet onmiddellijk (1 "freebie" per week) — geen straf-mechanisme voor een zieke of drukke dag.
3. **Transparant.** Stijn ziet realtime hoeveel punten hij heeft, welke beloning de volgende mijlpaal is, en hoe ver hij nog moet.
4. **Ouder configureert beloningen, kind ziet alleen mijlpalen.** Belonings-bedrag/object is door ouder in te stellen (niet door kind te wijzigen).

### Puntensysteem (eerste voorstel — TBD)

| Actie | Punten |
|---|---|
| Blok afgerond met mastery ≥ 80% | 10 |
| Blok afgerond met mastery 50–79% | 5 |
| Blok afgerond met mastery < 50% | 2 (deelname-punt) |
| Dagdoel gehaald (alle geplande blokken) | +15 |
| Weekstreak (7 dagen achter elkaar plan gehaald, rustdagen tellen mee) | +50 |
| Vak "klaar voor PWW" (alle onderwerpen ≥ 80% mastery) | +75 |

> Per onderwerp telt het hoogste behaalde mastery-niveau, niet de optelsom van pogingen — opnieuw doen voor extra punten heeft geen zin (anti-grinding).

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
├── points-log.jsonl       # append-only: timestamp, actie, punten, reden
├── milestones.json        # geclaimde + nog niet geclaimde
└── rewards-config.json    # ouder-instellingen
```

## 9. Multi-user (P6)

- **Verwachte schaal:** halve klas, ~10–15 gebruikers.
- **Toegang:** **open link**. Wie de URL kent kan een account aanmaken. Aanmelden via magic-link of e-mail+wachtwoord.
- **Content-eigendom:** **één gedeelde content-set** (Stijns boeken/screenshots), beheerd door Ralph. Klasgenoten gebruiken dezelfde trainers — zij kunnen geen content uploaden of wijzigen (in v1).
- **Per gebruiker eigen:**
  - Account
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
- **Twee primaire schermen:**
  1. **Vandaag** — dagweergave met blokken, één tap om te starten.
  2. **Voortgang** — per vak een rij, % klaar, welke onderwerpen rood/oranje/groen.
- **Trainerscherm:** groot, één vraag/kaart per keer, swipe/tap voor "weet ik" of "moeite mee".
- **Lage cognitive load:** weinig kleuren, duidelijke knoppen, geen afleidende notificaties.
- **Beloning zichtbaar maar subtiel:** punten-balkje op Vandaag-scherm, niet dominant.
- **Tech:** React + Vite + Tailwind + shadcn/ui (zie §11).

## 11. Tech stack

| Laag | Keuze | Reden |
|---|---|---|
| Frontend | **React + Vite + TypeScript + Tailwind** | Statisch builden voor GitHub Pages, brede community, makkelijke AI-coding |
| UI-componenten | **shadcn/ui** (radix + tailwind) | Mobile-first, toegankelijk, copy-paste model past bij static SPA |
| State | **Zustand** (lokaal) + Firestore listeners (server-sync) | Simpel, voldoende voor deze schaal |
| Auth | **Firebase Auth** (e-mail + magic-link) | Geïntegreerd met Firestore-security-rules |
| Database | **Firestore** | Real-time, security rules per user, gratis tier voldoende voor 15 users |
| Bestandsopslag (screenshots) | **Firebase Cloud Storage** | Beheerd door Ralph, klasgenoten alleen-lezen via signed URLs |
| Serverless functies (LLM-proxy) | **Firebase Cloud Functions (Node.js)** | Anthropic API-sleutel server-side, rate limiting per user |
| LLM voor beoordeling Cat 3/4 | **Claude Haiku 4.5** (snel + goedkoop) | Past in €100/maand-budget bij ~15 users |
| LLM voor content-extractie + validator | **Claude Opus 4.8** (vision) | Eenmalig per content-update, kwaliteit boven kosten |
| Hosting frontend | **GitHub Pages** (vanuit `apps/web/dist`) | Gratis, ingebouwde CI via Actions |
| Domein | `<repo>.github.io/pww` (geen custom domein) | Geen voorkeur opgegeven |
| Budget | **€100/maand cap** | Hard cap; bij overschrijding stopt LLM-routes met `429 quota_exceeded` |

### LLM-quota verdeling (Stijn-voorrang) + graceful degradation

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

### Consequenties van GitHub Pages + Firebase

- **Geen server-side rendering** — volledige SPA.
- **Alle dynamische routes via Firestore + Cloud Functions** — geen Next.js API-routes.
- **Anthropic-API key staat alleen in Cloud Functions**, nooit in frontend bundle.
- **Routing via hash-based router** (`#/vandaag`) of `BrowserRouter` met fallback `404.html` (GitHub Pages SPA-trick).
- **Validator (apps/validator)** draait als losse Node-CLI lokaal bij Ralph, niet in productie. Output committen naar repo. Productie-app trust de gevalideerde JSON.

### Globaal budget-monitoring

Cloud Function logt elke LLM-call met cost-estimate naar Firestore-collection `usage`. Een dagelijkse job (of dashboard-pagina in app) toont running total per gebruiker en globaal. Cap-handhaving:
- **Soft cap €80**: app toont waarschuwing voor Ralph.
- **Hard cap €100**: alle LLM-calls retourneren `429` tot maand-reset.

## 12. Open punten — eerstvolgende iteratie

> **Status:** alle architectuur- en planning-vragen zijn beantwoord. Twee resterende items zijn Ralph-inputs die niet blokkerend zijn voor het bouwen van de app — ze worden gevuld via de admin-UI (beloningen) of via content-upload (scope).

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
- [ ] **Per vak: scope** (hoofdstukken/paragrafen/woordenlijsten) — *deferred, Ralph komt erop terug*
- [x] ~~Validatie-strengheid~~ (hybride: strikt voor wiskunde + cat. 1, soft ≤10% voor cat. 3/4 — zie §6)
- [x] ~~Tech-stack definitief~~ (React+Vite, Firestore, Firebase Auth, Cloud Functions, Claude Haiku/Opus — zie §11)
