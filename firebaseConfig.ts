// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Constants from "expo-constants";

// Leer config inyectada vía app.config.js (extra.firebase)
const firebaseExtra =
  (Constants?.expoConfig as any)?.extra?.firebase ||
  (Constants as any)?.manifest?.extra?.firebase;

const required = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

for (const key of required) {
  if (!firebaseExtra?.[key] || String(firebaseExtra[key]).trim().length === 0) {
    throw new Error(`Falta la variable de entorno ${key} en extra.firebase. Configura tu .env y reconstruye.`);
  }
}

const firebaseConfig = {
  apiKey: firebaseExtra.apiKey as string,
  authDomain: firebaseExtra.authDomain as string,
  projectId: firebaseExtra.projectId as string,
  storageBucket: firebaseExtra.storageBucket as string,
  messagingSenderId: firebaseExtra.messagingSenderId as string,
  appId: firebaseExtra.appId as string,
  measurementId: firebaseExtra.measurementId as string | undefined,
};

const app = initializeApp(firebaseConfig);

// Exportar Firestore y Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app