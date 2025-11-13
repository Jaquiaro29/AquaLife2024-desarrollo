// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBs-F5DsK-jlEPoCZkaVsXJBwt91OBoEBg",
  authDomain: "aqualife2024-4b5fd.firebaseapp.com",
  projectId: "aqualife2024-4b5fd",
  storageBucket: "aqualife2024-4b5fd.firebasestorage.app",
  messagingSenderId: "642616945035",
  appId: "1:642616945035:web:6e390fcb0f394baab8278e",
  measurementId: "G-2W09HBRVK1"
};

const app = initializeApp(firebaseConfig);

// Exportar Firestore y Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app