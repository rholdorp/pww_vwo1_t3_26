# PWW vwo1 t3 '26 — trainer & planner

Webapp die Stijn (en klasgenoten) helpt zich voor te bereiden op de proefwerkweek van trimester 3, klas 1 Atheneum (29 juni – 3 juli 2026). Bestaat uit een persoonlijke planner en interactieve trainers per vak.

Volledige specificatie: [SPEC.md](SPEC.md).

## Structuur

```
content/        ruwe screenshots + afgeleide trainer-content (los van code)
apps/web/       React + Vite frontend (GitHub Pages target)
apps/validator/ CLI die trainer-content vergelijkt met ruwe screenshots
packages/       gedeelde engines (trainer, planner) en types
progress/       Firestore-data-model documentatie (productie staat in Firebase)
```

## Tech

React + Vite + Tailwind + shadcn/ui · Firebase (Auth, Firestore, Cloud Functions, Storage) · Claude Haiku/Opus voor beoordeling en content-extractie · GitHub Pages voor hosting.

## Setup

```bash
npm install
npm run dev          # apps/web
npm run validate     # apps/validator
```

Vereist Node ≥ 20.
