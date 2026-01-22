// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Constants from "expo-constants";

// Read firebase config from EXPO_PUBLIC_* env (bundled for web), then override Constants extras
// Using direct process.env references so Metro/Expo pueda inyectar los valores en tiempo de build web
const envConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const constantsConfig =
  (Constants?.expoConfig as any)?.extra?.firebase ||
  (Constants as any)?.manifest?.extra?.firebase ||
  {};

// Env takes precedence; fall back to constants where env is missing
const firebaseExtra = { ...constantsConfig, ...envConfig } as Record<string, string>;

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
    throw new Error(
      `Falta la variable de entorno ${key} en extra.firebase. Configura tu .env y reconstruye.`
    );
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

// Export Firestore and Auth singletons
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;