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
# Keyless: alleen de onafhankelijke OCR-coverage (macOS Vision).
npm run validate -- --vak=frans

# Volledig: óók de bidirectionele paar-diff (vereist ANTHROPIC_API_KEY).
ANTHROPIC_API_KEY=sk-... npm run validate -- --vak=frans --extract
```

Het rapport komt in `apps/validator/reports/<vak>-validation.md`. Exitcode `0` =
PASS, `1` = FAIL, `2` = gebruiksfout (vak ontbreekt / geen content).

### Vlaggen

| Vlag | Default | Betekenis |
| --- | --- | --- |
| `--vak=<vak>` | _(verplicht)_ | Welk vak valideren (bv. `frans`). |
| `--editie=<editie>` | `2026-t3` | Welke content-editie. |
| `--extract` | uit | Extraheer ontbrekende screenshots via de Anthropic-vision-API en cache het resultaat. Vereist `ANTHROPIC_API_KEY`. |

## Twee onafhankelijke lagen

De validator vergelijkt de trainer-content nooit met zichzelf, maar altijd met
een **onafhankelijke tweede waarnemer** van dezelfde screenshots. Er zijn er
twee, bewust op verschillende technologie — defense-in-depth:

### 1. Paar-diff (vision-LLM) — vereist een key

`src/compare.ts` + `src/verdict.ts` + `src/report.ts`. Een vision-model
(`AnthropicRawExtractor`) leest elke screenshot opnieuw en levert NL↔vreemd
**woordparen**. Die worden bidirectioneel tegen de trainer gelegd:

- **missing** — staat in de screenshots, ontbreekt in de trainer → **FAIL**
- **hallucinated** — staat in de trainer, niet in de screenshots → **FAIL**
- **mismatch** — zelfde item, andere vertaling → waarschuwing

Resultaten worden per screenshot gecachet op fingerprint (SHA256) in
`content/<editie>/cache/raw-facts/<vak>/`, zodat herhaalde runs gratis en
idempotent zijn (SPEC §4). Zonder `--extract` (en dus zonder cache) draait deze
laag niet en is het oordeel een eerlijke FAIL: "geen onafhankelijke extractie".

> **Let op de onafhankelijkheid.** Het vision-model is verwant aan het model dat
> de trainer-content maakte; gedeelde blinde vlekken zijn mogelijk. De waarde van
> deze laag zit vooral in reproduceerbaarheid/CI én in het vangen van
> *hallucinated* + *mismatch*, die de OCR-laag niet ziet.

### 2. OCR-coverage (macOS Vision) — geen key

`native/ocr.m` + `src/ocr.ts` + `src/coverage.ts`. Een **on-device OCR-engine**
(Apple Vision) leest dezelfde screenshots met compleet andere technologie dan een
taalmodel — een écht onafhankelijke waarnemer, volledig lokaal, zonder keys.

OCR levert losse tekstregels (geen paren), dus deze laag beantwoordt de
complementaire vraag: **komt elke gedrukte regel terug in de trainer?** Een regel
die nergens matcht is _mogelijk_ gemiste stof en wordt ter review in het rapport
gezet. Het is bewust een **review-aid, geen harde gate**: OCR pikt ook koppen,
paginanummers, uitleg en zelfs handgeschreven aantekeningen op. De mens bevestigt
of een ongedekte regel echt ontbrekende stof is.

Sterk in het vangen van **missing** (de gevaarlijkste P8-fout), zwak in
*hallucinated*. Daarom vullen de twee lagen elkaar aan.

#### Native binary

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
```
