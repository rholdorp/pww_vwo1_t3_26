# Deploy — GitHub Pages + Firebase

Productie-deploy van de PWW Trainer. Eenmalige setup; daarna deployt elke push naar `main` automatisch.

**Doelstelling stack:**

| Onderdeel | Waar |
|---|---|
| Statische webapp (`apps/web`) | GitHub Pages, gehost op `https://rholdorp.github.io/pww_vwo1_t3_26/` |
| Cross-device voortgang | Firestore (Cloud Firestore, naam-slug = doc-sleutel) |
| Cat 4 LLM-feedback (Nederlands schrijven) | Firebase Cloud Functions (Anthropic Haiku, key in secret) |
| Deploy-trigger | GitHub Actions, op push naar `main` |

---

## 1. Firebase project aanmaken

In de [Firebase Console](https://console.firebase.google.com/):

1. **Create a project** → naam bv. `pww-vwo1-t3-26`. Google Analytics mag uit.
2. Project openen → ⚙️ → **Project settings** → kopieer het **Project ID** (bv. `pww-vwo1-t3-26-abc12`).
3. **Web app registreren:** Project settings → onder "Your apps" klik op **</>** (web). Nickname `pww-web`. **NIET** Firebase Hosting aanvinken (Pages doet hosting). Klik **Register app**.
4. Firebase toont een config-object:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "<projectId>.firebaseapp.com",
     projectId: "<projectId>",
     storageBucket: "<projectId>.appspot.com",
     messagingSenderId: "...",
     appId: "1:...:web:..."
   };
   ```
   Bewaar deze waarden — gaan in stap 3 (GitHub Variables).
5. **Firestore activeren:** linker menu → **Build → Firestore Database** → **Create database** → **Production mode** → locatie `europe-west` (Belgium). Klik Enable.
6. **Blaze plan activeren** (vereist voor Cloud Functions met externe API-calls naar Anthropic): linker menu (helemaal onderaan) → **Upgrade** → **Blaze (pay as you go)** → koppel een betaalmethode + zet een **budget alert** op €5/maand. De free tier dekt onze schaal ruim.

---

## 2. Firebase CLI lokaal koppelen

Eenmalig op de laptop waar je deployed:

```bash
# Firebase CLI installeren (globaal)
npm install -g firebase-tools

# Inloggen
firebase login

# Project koppelen (vervang met je echte projectId)
firebase use --add
# → kies je nieuwe project, alias `default`
```

Dit overschrijft `.firebaserc` met het juiste projectId. Commit die wijziging.

Daarna:

```bash
# Firestore rules deployen
firebase deploy --only firestore:rules

# Anthropic API-key in Cloud secret zetten
firebase functions:secrets:set ANTHROPIC_API_KEY
# → plak de sk-ant-... key wanneer gevraagd

# Cloud Function deployen
npm install --prefix apps/functions
firebase deploy --only functions
```

Na deploy print Firebase de Cloud Function URL, bv.:
```
✔ functions[schrijfFeedback(europe-west1)]: Successful create operation.
Function URL (schrijfFeedback): https://europe-west1-<projectId>.cloudfunctions.net/schrijfFeedback
```

De **basis-URL** is alles vóór `/schrijfFeedback`: `https://europe-west1-<projectId>.cloudfunctions.net`. Bewaar — gaat in stap 3.

---

## 3. GitHub Pages + Variables

In GitHub (web-UI):

1. **Repo settings → Pages** → **Source:** `GitHub Actions`. (Niet `Deploy from branch`.)
2. **Repo settings → Secrets and variables → Actions → Variables tab** → klik **New repository variable** voor elk van:

   | Variable name | Waarde |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `AIza...` uit stap 1.4 |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `<projectId>.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `<projectId>` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `<projectId>.appspot.com` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `...` |
   | `VITE_FIREBASE_APP_ID` | `1:...:web:...` |
   | `VITE_FIREBASE_FUNCTIONS_REGION` | `europe-west1` |
   | `VITE_FUNCTIONS_BASE_URL` | `https://europe-west1-<projectId>.cloudfunctions.net` |

   > Deze gebruiken **Variables** (niet Secrets) — Firebase web-config is publiek per [Firebase-docs](https://firebase.google.com/docs/projects/api-keys). Variables zijn zichtbaar in de UI; Secrets niet. Sleutels in de client-bundle worden hoe dan ook leesbaar voor iedere bezoeker.

3. **Trigger eerste deploy:** push een commit (of klik **Actions → Deploy to GitHub Pages → Run workflow**).

Na een paar minuten staat de app live op `https://rholdorp.github.io/pww_vwo1_t3_26/`.

---

## 4. Verificatie-checklist

Na deploy:

- [ ] Open de Pages-URL → naam invullen → trainer start
- [ ] Open Firestore Console → **Data** → check dat er een `progress/<jouw-naam-slug>` document verschijnt na 1-2 oefen-vragen
- [ ] Open de app op een tweede device, vul **dezelfde naam** in → progress is identiek (cross-device sync werkt)
- [ ] Open de Nederlands schrijftrainer, schrijf 2-3 zinnen, klik "Feedback" → Cloud Function antwoordt (geen 503 "no-key")

---

## 5. Daily flow — wat deployt automatisch en wat niet

| Wijziging | Auto-deploy via GH Actions? |
|---|---|
| Content (`content/2026-t3/...`) | ✅ |
| Web-app code (`apps/web/...`) | ✅ |
| Cloud Function (`apps/functions/...`) | ❌ — handmatig: `firebase deploy --only functions` |
| Firestore rules (`firestore.rules`) | ❌ — handmatig: `firebase deploy --only firestore:rules` |

> Function + rules deploys zijn handmatig met opzet — ze raken backend-state en moeten bewust gebeuren. We kunnen later een aparte workflow toevoegen die ze pusht na manuele approval.

---

## 6. Troubleshooting

- **Pages-deploy faalt op "permissions error"**: Repo settings → Actions → General → **Workflow permissions** → "Read and write permissions". Spaar daarna opnieuw.
- **App laadt maar geen sync**: check browser console; meestal `VITE_FIREBASE_API_KEY` mist of typo in een Variable. Doe `Settings → Variables`, fix, en re-run workflow.
- **Feedback-knop geeft 503 "no-key"**: secret nog niet geupload. `firebase functions:secrets:set ANTHROPIC_API_KEY` en `firebase deploy --only functions`.
- **Function CORS-error**: de Function staat al op `cors: true`, dus dit zou niet moeten kunnen. Check dat `VITE_FUNCTIONS_BASE_URL` exact `https://<region>-<projectId>.cloudfunctions.net` is (geen trailing slash, geen `/schrijfFeedback`-suffix).
