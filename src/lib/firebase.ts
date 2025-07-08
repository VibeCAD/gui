import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const analytics = getAnalytics(app);

// Connect to emulators in development
if (import.meta.env.DEV && !window.location.hostname.includes('localhost.run')) {
  // Check if we should use emulators (can be disabled with env var)
  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  
  if (useEmulators) {
    // Prevent multiple connections to emulators
    if (!window._emulatorsConnected) {
      window._emulatorsConnected = true;
      
      console.log('🔧 Attempting to connect to Firebase Emulators...');
      
      try {
        connectAuthEmulator(auth, 'http://localhost:9099');
        console.log('✅ Connected to Auth emulator');
      } catch (error) {
        console.warn('⚠️ Auth emulator connection failed:', error);
      }
      
      try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        console.log('✅ Connected to Firestore emulator');
      } catch (error) {
        console.warn('⚠️ Firestore emulator connection failed:', error);
      }
      
      try {
        connectStorageEmulator(storage, 'localhost', 9199);
        console.log('✅ Connected to Storage emulator');
      } catch (error) {
        console.warn('⚠️ Storage emulator connection failed:', error);
      }
      
      try {
        connectFunctionsEmulator(functions, 'localhost', 5001);
        console.log('✅ Connected to Functions emulator');
      } catch (error) {
        console.warn('⚠️ Functions emulator connection failed:', error);
      }
      
      console.log('🔧 Firebase Emulators setup complete. Visit http://localhost:4000 for Emulator UI');
    }
  } else {
    console.log('🌐 Using production Firebase services. Set VITE_USE_FIREBASE_EMULATORS=true to use emulators.');
  }
}

// Add TypeScript declaration for the window property
declare global {
  interface Window {
    _emulatorsConnected?: boolean;
  }
}

export default app;