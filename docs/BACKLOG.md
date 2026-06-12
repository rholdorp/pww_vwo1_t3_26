# PWW Trainer — Backlog / SPEC-implementatiestatus

Lopende lijst van wat er t.o.v. [SPEC.md](../SPEC.md) nog open staat. Bijwerken bij
elke afgeronde stap. Legenda: ✅ klaar · 🟡 deels · ❌ nog niet · 🔜 nu mee bezig.

_Laatst bijgewerkt: 2026-06-12_

## Nu mee bezig
- (niets — volgende item kiezen)

## Recent afgerond
- ✅ **Gelabelde diagrammen / hotspots (`diagram.json`)** — §4/§5. Eén engine, twee
  richtingen (**benoem** = oplichten→typen, **aanwijs** = naam→klik), twee bron-types:
  shaped SVG met `data-region` (biologie skelet 25 + spieren 13, hergebruikt uit
  `~/projects/vwo1_t3_26_bio`) én achtergrondafbeelding + cirkel-overlay (topografie,
  12 landen op de gekleurde kaart). Draait op Cat-1-logica (Leitner/normalisatie);
  beide richtingen delen de Leitner-ids. **Bewuste SPEC-afwijking:** SVG `data-region`
  + %-markers i.p.v. pixel-`coords` uit §4 (schoner/schaalbaar). Wiskunde-figuren: later.

## Trainer-engines (§5)
- ✅ Cat 1 (vocab/feiten): intypen + Leitner + normalisatie + in-sessie-requeue.
- ✅ Cat 2 (wiskunde, pen-en-papier) — **H8 gebouwd (2026-06-10).** Adaptieve engine
  (`packages/trainer-engine/cat2.ts`: 2 random/onderdeel → 2/2 ✓ · 1/2 +2 (≥3/4) · 0/2 +2,
  synthese-lock) + strikt nakijken (`mathClean.ts` `wiskundeGelijk`: alléén cosmetisch, geen
  CAS — de simpelste vorm uit het antwoordenboekje is het antwoord; `exacteVorm` voor wet.
  notatie) + `Cat2Trainer`-UI (✏️ maak op papier, helperrij, kralenketting, fout→antwoord +
  vergelijkbare som). Content: `opgaven.json` (312 opgaven, Voorkennis+§8.1–**8.5**, **elke Q→A
  tegen het antwoordenboekje én door eigen berekening geverifieerd**) + `flashcards.json`
  (15 regel-kaarten).
  - **§8.5 (machten en letters) toegevoegd 2026-06-12:** 125 opgaven (opg 60–85 + leerroute
    L10/L11/L12, p125–131) + 7 regelkaarten (vermenigvuldigen = exponenten optellen,
    gelijksoortige termen, delen = exponenten aftrekken, optellen↔vermenigvuldigen↔delen).
    "k.n." (kan niet) is conform het boek het antwoord bij niet-gelijksoortige termen;
    de matcher accepteert ook "kan niet"/"kn" (acceptedForms, getest in `mathClean.test.ts`).
  - **Bewust NIET opgenomen (eerlijk, P8):** figuur-opgaven (oppervlakte/omtrek, priemfactor-
    figuur, 65 piramide, 67 kubus), woordproblemen/open vragen (66a, 73, E76 dubbel-invul),
    breuk-coëfficiënt-antwoorden (matcher-onveilig, o.a. 84a), `*`-antwoorden (tekening/
    uitwerking). **Herscan nodig:** opg 37 (geen vraag-scan). De oude notitie "A55/L8 geen
    antwoord-scan" was achterhaald: bijlage-foto's PXL_…064343217 (p30) en …064345600.MP (p31)
    dekken opg 55–85 + Gemengd 1–4 (vastgesteld 2026-06-12).
  - **H9 meetkunde (2026-06-10):** **concept-flashcards LIVE** — 37 kaarten over §9.1–9.5
    (symmetrie, driehoeken, vierhoeken, Z/F-hoeken + reken-regels) in `flashcards.json`,
    getrouw uit de boek-theorie. Plumbing voor figuur-bij-opgave is gebouwd (`afbeelding`
    op `Opgave`/`Card`, `°`-tolerantie in `wiskundeGelijk`, image-glob `assets/wiskunde/`).
  - **H9 numerieke hoek-opgaven (2026-06-10):** **eerste set LIVE** — 10 Cat-2 hoek-opgaven
    §9.3 (opg 41/42/43, gelijkbenige driehoek) mét bijgesneden figuur (`assets/wiskunde/h9/`),
    via `scripts/build-wiskunde-h9-opgaven.mjs`. **Elk triple (vraag + figuur + antwoord) is
    met de hand geverifieerd** tegen lesboek p167 + antwoordsleutel p41 + eigen geometrie-
    controle. NB: een eerdere agent-run koppelde figuur-nr ≠ opgave-nr (mismatch) — opgevangen
    bij verificatie (P8), niet geshipt. °-teken wordt door de matcher genegeerd (`70` = `70°`).
  - **Nog open:** binair-onderzoek (extensie, optioneel); **meer H9-hoek-opgaven**
    (rest van §9.3 + §9.5 Z/F-hoeken) — zelfde recept: figuur croppen + boek-antwoord +
    zelf verifiëren; H8 Gemengde opgaven/Herhaling (p132–142, antwoordfoto's aanwezig) als
    extra oefenvoorraad. Validator-grounding voor Cat 2 niet gewired → `gevalideerd` blijft false.
- ✅ Cat 3 (begrip): flashcards + oefenvragen in flashcard-modus. **LLM-rubric +
  samenvatting-lees-fase DESCOPED** (besluit 2026-06-07: flashcards volstaan; alleen NL krijgt LLM).
- ✅ Cat 4 — **Nederlands** schrijftrainer mét LLM-feedback via **Cloud Function**
  (`apps/functions`, Haiku, key als Firebase-secret); dev-middleware blijft voor lokaal.
  Engels (Cat 4 secundair) blijft flashcard-modus (LLM descoped).
- ✅ Gelabelde diagrammen / hotspots (`diagram.json`) — biologie skelet/spieren +
  topografie ZO-Azië, beide richtingen (benoem + aanwijs). Zie "Recent afgerond".

## Planner (§7)
- ✅ **Meerdaagse planner-engine** (`packages/planner-engine`, getest): verdeelt alle
  content over 8–21 juni (dekking vóór de herhaalweek), herhaalweek 22–28 = review-only,
  max 3 vakken/dag, 30-min vak-blokken (meerdere trainer-blokjes), content in volgorde,
  engels = boek-blokken; wiskunde is sinds 2026-06-10 een echt content-vak (H8 Cat-2),
  nederlands cap 3, herplannen bij falen (recompute op mastery), pacing-flags bij overflow.
- ✅ **Uitloop-regel + dag-uitzonderingen (afspraak 2026-06-12):** za 13/6 (verjaardags-
  feest) = leer-dag met cap 2 (~1 uur, slot-cap-override in `DagSlot.cap`). Past de stof
  niet vóór de herhaalweek (ook niet op 2 u/dag), dan mag leren per vak uitlopen tot
  uiterlijk **3 dagen vóór de toets**; de laatste 3 dagen zijn altijd herhalen/
  automatiseren (dagelijkse vakken krijgen daar een review-slot i.p.v. nieuwe stof).
  Escalatieladder in `kalenderSchema`: 1,5 u/dag → 2 u/dag → uitloop; harde flag alleen
  voor stof die zelfs dan nergens past.
- ✅ **Maandkalender** (Kalender-tab): vooruitblik (vak-chips per dag, toetsdagen 🎯,
  herhaalweek-tint) + terugblik (bevroren dagschema + status ✓/◐/○; vult zich naarmate
  dagen verstrijken). Dagdetail toont de trainer-blokjes + START voor vandaag.
- ✅ **Dagdeel-suggesties + minuten-indicatie (2026-06-12):** elk gepland blok krijgt op
  Vandaag + Kalender-dagdetail een moment-suggestie (na school / voor het eten / na het
  eten; weekend: ochtend/middag) en een ±minuten-schatting; de dag-kop toont het totaal.
  De schatting is **zelfcorrigerend**: `duurFactoren`/`geschatteMin` (gamification.ts)
  vergelijken werkelijke sessieduren uit de resultaten-log met de `duurMin`-heuristiek
  (mediaan per soort, ≥3 metingen, geklemd 0,5–2,5×).
- 🟡 Resten: vaste **klokuren** + **huiswerk/pauze-blokken**; de gecorrigeerde duur
  voedt nog niet de planner-inpakking (alleen weergave). Vandaag-scherm leunt nog op de
  oude `planVandaag` (kan later op de engine's "vandaag" gezet worden).

## UI / schermen (§7, §10)
- ✅ Vandaag (default) + Kalender + Voortgang + NaamPoort + mobile-first.
- ✅ **Mini-progress-widget** (🔥 streak / punten / volgende mijlpaal + balk / vandaag X/Y) —
  op Vandaag (met teller) + Oefenen/Kalender (zonder teller).
- ✅ **Oefenen = vak-tegels** (drill-down per vak), **klikbare kalender-taken**.
- 🟡 Nav = Vandaag/Kalender/Oefenen/Voortgang; **"Instellingen"-tab ontbreekt** (rooster/
  voorkeuren/beloningen-config).
- ✅ **Sessie-timer** + focus-bonus (≥15 min +5, ≥30 min +15), **afrondings-modal**
  (tijd/focus/punten/mijlpaal), **sparkline** (7-daagse activiteit per vak),
  **"alleen nog te doen"-filter**, **accent-helper-rij** (é è ê ç…) voor Frans,
  **confetti-burst** bij dagdoel (1×/dag).
- 🟡 Geen Tailwind/shadcn — eigen CSS.

## Gamification (§8)
- ✅ **Append-only resultaten-log** (`gamification.ts`, SPEC §8 bron-van-waarheid) — trainers
  loggen elk afgerond blok.
- ✅ **Punten/streaks/mijlpalen** als pure afgeleide view: blok ✓ 10/15, deels 2, vak-klaar
  +75, dagdoel +15, weekstreak +50, **focus-bonus** (≥15 min +5, ≥30 min +15) (anti-grinding:
  hoogste per blok).
- ✅ **Beloningsladder definitief (2026-06-12, door Ralph vastgesteld):** 9 stappen —
  Aftrap 25 / Sprintje 90 / Brons 170 / Volhouder 260 / Zilver 350 / Doorzetter 470 /
  Goud 650 / Flapdrol 850 / Eindbaas 1100 — **max 1 beloning per dag** (~65 pt/dag): de
  eerste dagen elk één kleine stap om aan te haken, daarna ±elke 2 dagen één. De
  beloningen zijn échte, met Ralph afgesproken beloningen (zakgeld, ijsje in Duitsland,
  game-tegoed, bowlen, karten als eindbaas) — niet langer placeholders.
- ✅ **Concreet beloningsadvies (`beloningAdvies`):** "nog X pt ≈ N blokken (±D dagen)" +
  de beloning zelf, overal verwerkt: widget (alle tabs), beide afrondings-modals en de
  Voortgang-tab (ladder met ⭐-volgende + voortgangsbalk + puntenuitleg).
- 🟡 Afvink-criterium per blok = mastery-drempels (coverage-criterium niet apart).
- ❌ **Ouder-configureerbare beloningen** (nu standaard-tekst, niet bewerkbaar) — later, met de
  Instellingen-tab.

## Multi-user & data (§9, §11)
- ✅ **Firestore cross-device sync** (`firestoreSync.ts` + `firebase.ts`) — voortgang per
  naam-slug naar `/progress/{slug}`; offline-cache + multi-tab; valt elegant terug op
  localStorage als er geen Firebase-config is. Rules: open read, self-attested write
  (`firestore.rules`, bewuste keuze Ralph — geen auth).
- ✅ Naam-identiteit (geen auth).
- ✅ **Cloud Function `schrijfFeedback`** (`apps/functions`, Haiku) — `ANTHROPIC_API_KEY`
  als Firebase-**secret** (server-side, niet in de bundle). NL-schrijftrainer draait
  hierop in productie (dev-middleware blijft voor lokaal).
- ✅ **Deploy-infra**: GitHub Pages (web) + Firebase (`firebase.json`, `.firebaserc`).
  Web-config via `VITE_FIREBASE_*`-env-vars op build-tijd.
- ❌ Cloud Storage (signed-URL screenshots), budget/quota-machinerie — nog uitgesteld
  (runtime-LLM nu alleen NL → laag risico).

## Content & pipeline (§4, §6)
- ✅ Content los van code; manifest scope-checklist; validator-tool (`npm run validate`).
- 🟡 End-to-end `npm run pipeline` niet gedraaid (content handmatig via vision-agents).
- 🟡 Validator niet als gate gedraaid → `gevalideerd` ~overal false (geschiedenis op
  basis van menselijke review compleet).
- ❌ Completeness-gate ín de app ("leer dit vak uit het boek"-placeholder, P8).
- ❌ Stage 6 deploy-flow / `cache/verified/`.

## Vak-scope status (P8)
- ✅ Geschiedenis: compleet (door Ralph/Stijn nagekeken).
- 🟡 Biologie / Frans / Aardrijkskunde / Nederlands: gedekt, `gevalideerd=false`.
- ❌ Engels: nog leeg — content komt zodra Stijn de stof van de docent heeft.

## Open (Ralph, niet-blokkerend)
- ❌ Externe beloningen koppelen aan mijlpalen (brons/zilver/goud/platina).
