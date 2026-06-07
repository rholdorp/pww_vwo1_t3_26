# PWW Trainer — Backlog / SPEC-implementatiestatus

Lopende lijst van wat er t.o.v. [SPEC.md](../SPEC.md) nog open staat. Bijwerken bij
elke afgeronde stap. Legenda: ✅ klaar · 🟡 deels · ❌ nog niet · 🔜 nu mee bezig.

_Laatst bijgewerkt: 2026-06-07_

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
- ❌ Cat 2 (wiskunde, pen-en-papier): niet gebouwd (geen wiskunde-content). *Later.*
- 🟡 Cat 3 (begrip): flashcards + oefenvragen in flashcard-modus; **lees-fase
  (samenvatting.md) + LLM-rubric (Haiku) ontbreken**.
- 🟡 Cat 4 (tekst): Nederlands-schrijftrainer mét LLM (dev-middleware); **lees-fase
  + meerkeuzevragen ontbreken**.
- ✅ Gelabelde diagrammen / hotspots (`diagram.json`) — biologie skelet/spieren +
  topografie ZO-Azië, beide richtingen (benoem + aanwijs). Zie "Recent afgerond".

## Planner (§7)
- 🟡 planVandaag werkt (top-3 blokken, PWW-datum + mastery, round-robin), maar
  **geen vaste tijdslots / schoolrooster / huiswerk- & pauze-blokken / duur /
  deeplink / timer / backward-planning / pacing-flags ("haal ik het?")**.

## UI / schermen (§7, §10)
- ✅ Vandaag (default) + Voortgang + NaamPoort + mobile-first.
- 🟡 Nav = Vandaag/Oefenen/Voortgang; **"Instellingen"-tab ontbreekt** (rooster/
  voorkeuren/beloningen).
- ❌ Mini-progress-widget (streak/punten/mijlpaal), timer-balkje, afronding-modal,
  sparkline, "toon alleen rood"-filter, accent-helper-rij.
- 🟡 Geen Tailwind/shadcn — eigen CSS.

## Gamification (§8) — bewust fase-2
- 🟡 Afvink-criterium per blok (mastery-drempels per soort); coverage-criterium niet echt.
- ❌ `blok-resultaten.jsonl` append-only log; punten/streaks/mijlpalen/ouder-beloningen.

## Multi-user & data (§9, §11)
- ❌ **Firestore cross-device sync** — nu localStorage; zelfde naam ≠ zelfde voortgang
  cross-device (SPEC noemt dit een dealbreaker).
- ✅ Naam-identiteit (geen auth), lokaal.
- ❌ Cloud Functions (LLM-proxy), Cloud Storage, budget/quota-machinerie — uitgesteld.
- ❓ GitHub Pages-deploy live? (build werkt; publicatie niet geverifieerd).

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
