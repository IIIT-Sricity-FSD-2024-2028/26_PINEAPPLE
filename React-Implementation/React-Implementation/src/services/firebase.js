import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCo5wT6vFTW1HSwA5uXEd1F_E5wfm35EzA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'team-forge-auth.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'team-forge-auth',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'team-forge-auth.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '908426332128',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:908426332128:web:785d4e53f976d92d1a8d85',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const githubProvider = new GithubAuthProvider();

// Connect to Auth Emulator if enabled
let emulatorConnected = false;
const useEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';
const emulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://localhost:9099';

if (useEmulator && !emulatorConnected) {
  try {
    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
    emulatorConnected = true;
    console.log(`[Firebase] Connected Auth to Emulator at ${emulatorUrl}`);
  } catch (err) {
    // connectAuthEmulator throws if called multiple times (e.g. during Vite HMR)
    console.warn('[Firebase] Emulator connection skipped or already initialized:', err?.message);
  }
}

// Dedicated phone-verify Firebase app and auth instance (Phase 3)
// Isolated from main app session to ensure OTP verification never alters client authentication state
let phoneVerifyApp;
let phoneVerifyAuth;
try {
  const existingPhoneApp = getApps().find((a) => a.name === 'phone-verify');
  phoneVerifyApp = existingPhoneApp || initializeApp(firebaseConfig, 'phone-verify');
  phoneVerifyAuth = getAuth(phoneVerifyApp);
  if (useEmulator) {
    try {
      connectAuthEmulator(phoneVerifyAuth, emulatorUrl, { disableWarnings: true });
    } catch (err) {
      console.log('[Firebase] Phone emulator already connected or notice:', err);
    }
  }
} catch (err) {
  console.warn('[Firebase] phone-verify app initialization error:', err?.message);
}

export { app, auth, googleProvider, githubProvider, phoneVerifyApp, phoneVerifyAuth };
export default auth;
