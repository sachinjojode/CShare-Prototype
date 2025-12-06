// Environment Configuration Loader
// Prefers window.ENV (env.js) and falls back to import.meta.env for Vite builds

function getEnvSource() {
  if (typeof window !== 'undefined' && window.ENV) return window.ENV;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env;
    }
  } catch (error) {
    // import.meta access can throw in non-module contexts; ignore and fallback
  }
  return null;
}

const envSource = getEnvSource() || {};

export const firebaseConfig = {
  apiKey: envSource.VITE_FIREBASE_API_KEY || "",
  authDomain: envSource.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: envSource.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: envSource.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: envSource.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: envSource.VITE_FIREBASE_APP_ID || ""
};

// Validate that all required config values are present
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  const message = `Missing Firebase configuration keys: ${missingKeys.join(', ')}. Please provide env.js or .env values.`;
  console.error(message);
  throw new Error(message);
}
