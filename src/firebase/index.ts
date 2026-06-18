import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

// IMPORTANT: This function is the single source of truth for Firebase initialization.
// It is designed to be idempotent (safe to call multiple times).
function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
  };
}

export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
} {
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }
  const app = getApp();
  return getSdks(app);
}

// Re-export core modules for convenience, but encourage using hooks from provider.
export { getApps, getApp } from 'firebase/app';
export { getAuth } from 'firebase/auth';
export { getFirestore } from 'firebase/firestore';
export { getStorage } from 'firebase/storage';

export * from './config';
