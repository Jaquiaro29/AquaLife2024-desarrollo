// Cargar variables de entorno forzando que .env tenga prioridad sobre el entorno del sistema
require('dotenv').config({ path: '.env', override: true });
const base = require('./app.json');

module.exports = () => {
  // Exponer variables como EXPO_PUBLIC_* para que el bundler las incruste en web
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '';
  process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID = process.env.FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '';
  const firebase = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  };

  try {
    const prefix = (firebase.apiKey || '').slice(0, 8);
    console.log(`[app.config] Firebase API key prefix: ${prefix}`);
  } catch {}

  return {
    ...base.expo,
    extra: {
      firebase,
    },
  };
};
