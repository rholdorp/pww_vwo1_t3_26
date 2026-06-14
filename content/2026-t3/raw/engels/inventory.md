# Engels — raw inventory

Methode: **insight elementary** (Oxford). PWW t3 2026, **eerste toets (ma 29-6)**.

Officiële toetsscope (PWW-detailscherm "PW Engels", foto Stijn 2026-06-14):

1. **Words unit 4 & 5** — WB blz. 139, 140 & 141
2. **Grammar unit 1 t/m 5 & past simple** — WB blz. 112 t/m 121 & 126+127 & alle aantekeningen
3. **Onregelmatige werkwoorden** — blz. 126

## Bronnen in deze map

### Grammar reference & practice (foto's WB, 2026-06-14)

Hernoemd `engels-wb-p<NN>.jpg`. Dekken **blz. 112–121 + 126–127** = de volledige
grammatica-scope. Per pagina de secties:

| Bestand | Blz | Secties |
|---|---|---|
| `engels-wb-p112.jpg` | 112 | W.1 *be* · W.2 possessive adjectives · W.3 this/that/these/those |
| `engels-wb-p113.jpg` | 113 | W.4 *have got* · W.5 object pronouns · W.6 articles a/an + the |
| `engels-wb-p114.jpg` | 114 | 1.1 present simple aff/neg · 1.2 present simple questions & short answers |
| `engels-wb-p115.jpg` | 115 | 1.3 *Wh-* question words · 2.1 adverbs of frequency |
| `engels-wb-p116.jpg` | 116 | 2.2 *can / can't* for ability |
| `engels-wb-p117.jpg` | 117 | 2.3 adverbs of manner · 3.1 there is/are with some, any, a/an |
| `engels-wb-p118.jpg` | 118 | 3.2 possessive *'s* · 3.3 possessive pronouns & *whose* |
| `engels-wb-p119.jpg` | 119 | (3.3 vervolg) · 4.1 present continuous |
| `engels-wb-p120.jpg` | 120 | 4.2 present simple of present continuous · 5.1 countable/uncountable nouns |
| `engels-wb-p121.jpg` | 121 | 5.2 quantifiers much/many/a lot of · 5.3 a little / a few |
| `engels-wb-p126.jpg` | 126 | 8.1 past simple affirmative · **8.2 common irregular verbs (lijst)** · 8.3 start |
| `engels-wb-p127.jpg` | 127 | 8.3 past simple negative & questions |

### Woordenlijst (vocab)

`wordlist-insight-elementary.pdf` — de complete boek-woordenlijst per unit (Welcome,
Unit 1–9) met **fonetiek + Engelse definitie + voorbeeldzin**. Unit 4 ≈ 75 woorden,
Unit 5 ≈ 64 woorden.

> **Vocab-aanpak (besluit Ralph 2026-06-14):** de toets vraagt vaak een Engelse
> definitie → vul het Engelse woord in (Stijns zwakke plek). Daarom is de vocabtrainer
> **definitie → woord** (Engels → Engels), volledig gegrond op de boek-woordenlijst —
> geen verzonnen NL-vertalingen nodig. Gegenereerd via `scripts/build-engels-vocab.mjs`
> (voorbeeldzin weggelaten, kopwoord gemaskeerd zodat het antwoord niet weglekt).
> NB: dit is de **volledige unit-4/5-woordenlijst** (superset van de exacte WB-selectie
> blz. 139–141, die we niet als foto hebben) — dekking is dus gegarandeerd, met mogelijk
> wat extra woorden.

## Status (2026-06-14)

- **Grammar (units 1–5 + past simple):** ✓ → `trainers/engels/flashcards.json`
  (62 kaarten: regels als flip-kaarten + tabellen/vormen als typ-kaarten).
- **Onregelmatige werkwoorden (blz. 126):** ✓ 26 werkwoorden (infinitief → past simple).
- **Vocab unit 4 & 5 (definitie → woord):** ✓ 104 kaarten (in flashcards.json, gegenereerd
  uit de wordlist via `scripts/build-engels-vocab.mjs`).
- **Zinnen NL → Engels:** ✓ `trainers/engels/vertaalzinnen.json` (22 samengestelde zinnen
  die grammatica + woorden combineren; profiel `en-zin`).
- **Open:** klas-/schrift-aantekeningen nog niet aangeleverd; exacte WB-woordselectie
  (blz. 139–141) niet als foto (superset gebruikt).
- `gevalideerd`: overal nog false (validator-gate niet gedraaid + menselijke review nog
  niet gedaan). Engels blijft daarom `GEPAUZEERD` in de planner tot de scope rond is;
  alle trainers zijn wél vrij te oefenen via de Oefenen-tab.
