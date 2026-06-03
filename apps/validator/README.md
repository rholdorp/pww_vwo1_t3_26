# @pww/validator

Bidirectionele validator voor trainer-content (SPEC §6). Bewaakt de twee
volledigheids-lagen uit P8 (zie [CLAUDE.md](../../CLAUDE.md)):

- **extractie-fideliteit** — klopt élk item in de trainer met wat er in de
  screenshots staat, en staat er niets in de trainer dat níét in de screenshots
  voorkomt?
- **scope-coverage** — staat élke gedrukte regel uit de screenshots ook ergens
  in de trainer-content (of is het bewust geen toetsbare stof)?

Een vak mag pas live als beide lagen schoon zijn. Een onvolledige tool is
gevaarlijker dan geen tool.

## Snel starten

```bash
# Standaard: onafhankelijke, KEYLESS OCR-validatie (macOS Vision). Geeft een
# echt PASS/FAIL-oordeel zonder API-key.
npm run validate -- --vak=frans

# Optioneel: voeg de API-paar-diff toe voor precieze mismatch-detectie.
ANTHROPIC_API_KEY=sk-... npm run validate -- --vak=frans --extract
```

Het rapport komt in `apps/validator/reports/<vak>-validation.md`. Exitcode `0` =
PASS, `1` = FAIL, `2` = gebruiksfout (vak ontbreekt / geen content).

### Vlaggen

| Vlag | Default | Betekenis |
| --- | --- | --- |
| `--vak=<vak>` | _(verplicht)_ | Welk vak valideren (bv. `frans`). |
| `--editie=<editie>` | `2026-t3` | Welke content-editie. |
| `--extract` | uit | Voeg de optionele API-paar-diff toe (precieze mismatch-detectie). Extraheert ontbrekende screenshots via de Anthropic-vision-API en cachet het resultaat. Vereist `ANTHROPIC_API_KEY`. |

## Twee onafhankelijke lagen

De validator vergelijkt de trainer-content nooit met zichzelf, maar altijd met
een **onafhankelijke tweede waarnemer** van dezelfde screenshots. De primaire laag
is keyless; de tweede is een optionele aanvulling — defense-in-depth.

### 1. OCR-validatie (macOS Vision) — primair, geen key

`native/ocr.m` + `src/ocr.ts` + `src/coverage.ts` + `verdictCat1Ocr`. Een
**on-device OCR-engine** (Apple Vision) leest dezelfde screenshots met compleet
andere technologie dan een taalmodel — een écht onafhankelijke waarnemer, volledig
lokaal, zonder keys. Dit is de laag die het PASS/FAIL-oordeel bepaalt.

OCR levert losse tekstregels (geen paren), dus de validatie is **bidirectioneel op
regel-/zijde-niveau**:

- **ongegrond → FAIL** — een trainer-zijde (NL of vreemd) die tekstueel nergens in
  de screenshots voorkomt. De trainer beweert iets zonder zichtbare bron
  (hallucinated). Schoon, hard signaal; fail-safe richting (P8).
- **ongedekt → waarschuwing** — een gedrukte OCR-regel die niet in de trainer
  staat. _Mogelijk_ gemiste stof, maar ruis-gevoelig (OCR pikt koppen,
  paginanummers en zelfs handschrift op), dus een review-aid voor de mens, geen
  harde gate.

Fuzzy matching (Levenshtein-ratio + containment, drempel `0.75`) tolereert
OCR-ruis zoals `Il` → `ll`/`|l`.

> **Limiet.** Een verkeerde vertaling die tekstueel dicht bij het origineel ligt
> (bv. `C'est ma cousine` i.p.v. `C'est mon cousin`) glipt door de regel-matching:
> dat ziet eruit als OCR-ruis. Subtiele *mismatch* vang je met laag 2.

### 2. API-paar-diff (vision-LLM) — optioneel, vereist een key

`src/compare.ts` + `src/verdict.ts` (`verdictCat1`). Een vision-model
(`AnthropicRawExtractor`) leest elke screenshot opnieuw en levert NL↔vreemd
**woordparen**. Omdat het de paren kent, kan deze laag iets dat OCR niet kan: een
**mismatch** (zelfde item, andere vertaling) precies aanwijzen. Draait alleen met
`--extract` en voegt zijn bevindingen toe aan het OCR-oordeel:

- **missing / hallucinated** → FAIL (overlapt met de OCR-laag, maar preciezer)
- **mismatch** → waarschuwing (de unieke meerwaarde van deze laag)

Resultaten worden per screenshot gecachet op fingerprint (SHA256) in
`content/<editie>/cache/raw-facts/<vak>/`, zodat herhaalde runs gratis en
idempotent zijn (SPEC §4).

> **Let op de onafhankelijkheid.** Het vision-model is verwant aan het model dat
> de trainer-content maakte; gedeelde blinde vlekken zijn mogelijk. De waarde van
> deze laag zit vooral in reproduceerbaarheid/CI en in precieze *mismatch*. De
> écht onafhankelijke waarnemer is de OCR-laag (andere technologie).

## Native OCR-binary (laag 1)

`src/ocr.ts` compileert `native/ocr.m` lazy met `clang` naar `native/ocr`
(gitignored) en roept het aan per afbeelding. Vereist macOS + Command Line Tools.
Op andere hosts slaat de coverage-laag zichzelf netjes over.

> De binary is in **Objective-C** geschreven, niet Swift: de Command Line Tools
> leveren een kapotte Swift-toolchain (compiler/SDK-versie-mismatch). `clang`
> compileert Objective-C rechtstreeks tegen de Vision-framework-headers en
> omzeilt dat probleem.

Handmatig compileren/testen:

```bash
cd apps/validator/native
clang -framework Foundation -framework Vision -framework AppKit -fobjc-arc -O2 -o ocr ocr.m
./ocr "../../../content/2026-t3/raw/frans/<bestand>.jpeg"   # → {"lines":[...]}
```

## Tests

```bash
npm test --workspace=apps/validator
```

De coverage-tests injecteren een nep-OCR-functie, dus ze draaien zonder de native
binary en op elke host.
