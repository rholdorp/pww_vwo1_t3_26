// Firebase-initialisatie. Web-config is PUBLIEK (per Firebase-docs) en wordt
// in de bundle gebakken via VITE_FIREBASE_*-env-vars op build-tijd.
//
// Geen config aanwezig → `db` blijft null en de app valt elegant terug op
// localStorage-only. Zo blijft lokaal ontwikkelen zonder Firebase werken.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const FUNCTIONS_REGION =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? "europe-west1";

export const firebaseEnabled = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;

if (firebaseEnabled) {
  app = initializeApp(config);
  // IndexedDB-cache + multi-tab sync — offline-tolerant + dezelfde voortgang
  // in een tweede tab van dezelfde browser. Faalt stil als IndexedDB niet
  // beschikbaar is (privé-modus, oudere browsers).
  try {
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    firestore = getFirestore(app);
  }
  functions = getFunctions(app, FUNCTIONS_REGION);
}

export const db = firestore;
export const fns = functions;
export const fbApp = app;
