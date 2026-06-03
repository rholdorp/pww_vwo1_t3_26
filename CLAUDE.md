# CLAUDE.md — context voor AI-assistenten

Gedeelde, gecommitte context voor wie (mens of AI) aan deze repo werkt. Volledige details: **[SPEC.md](SPEC.md)**.

## Wat dit is

Webapp die Stijn (klas 1 Atheneum) + ~10–15 klasgenoten helpt zich voor te bereiden op de proefwerkweek van trimester 3 2026 (PWW 29 juni – 3 juli). Twee delen: een **planner** met voortgang en **trainers per vak** (4 generieke leer-categorieën). Content staat los van code (per editie in `content/<editie>/`).

## Niet-onderhandelbaar (P8 — lees dit eerst)

- **De tool is Stijns single source of truth.** Volledigheid > snelheid.
- Een vak gaat **pas live als de scope 100% gedekt én gevalideerd is**; anders toont de app eerlijk "leer dit vak uit het boek". Een onvolledige tool is gevaarlijker dan geen tool — er is eerder gemiste stof precies op de toets gekomen.
- **De content-quality-stack niet versimpelen** (multi-pass extractie + self-critique + bidirectionele validator). De redundantie is bewust defense-in-depth.
- Twee lagen van "volledig", allebei vereist: **(a) scope-coverage** (is alle toetsbare stof vastgelegd? → scope-checklist in `manifest.yaml`) en **(b) extractie-fideliteit** (klopt alles uit de screenshots? → validator). Zie SPEC §4.

## v0.1 architectuur-besluiten (2026-06-03)

- **Hosting:** GitHub Pages (statische React/Vite-app). Repo is publiek; content (incl. schoolboek-materiaal) staat dus openbaar — bewust geaccepteerd, hosting/privacy later.
- **Data:** Firestore, **géén auth**. Naam invullen → naam (geslugd) is de Firestore-doc-sleutel → zelfde naam op telefoon én PC = zelfde voortgang (cross-device sync, dealbreaker). Open rules, bewust geaccepteerd voor deze schaal.
- **Firestore = alleen voortgang.** Content blijft static (meegebundeld), niet in Firestore.
- **Uitgesteld tot nodig:** Firebase Auth, Cloud Functions (LLM-proxy), Cloud Storage, budget/quota-machinerie. Cat 3/4 draaien tot dan in flashcard-modus zonder LLM.

## Huidige status

Repo is nog scaffolding (alleen `package.json`-stubs + manifest). Raw screenshots aanwezig: **biologie (35)**, **frans (7)**; overige 5 vakken nog leeg.

## Volgende mijlpaal

**Do 2026-06-04 — sessie met Stijn:** alle resterende content (screenshots) + de **volledige scope per vak** vastleggen in `content/2026-t3/manifest.yaml`. Zonder die scope kan geen enkel vak als "compleet" gelden. Let op: Engels is de vroegste PWW-deadline (ma 29/6) en heeft nu nog nul screenshots.

## Stack (zie SPEC §11)

React + Vite + TypeScript + Tailwind + shadcn/ui · Firestore (voortgang) · GitHub Pages. Monorepo: `apps/web`, `apps/validator`, `packages/{trainer-engine,planner-engine,shared}`, `content/`, `progress/`.
