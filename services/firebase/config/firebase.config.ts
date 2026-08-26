import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { logger } from "../../../shared/utils/logger";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

function getValidatedFirebaseConfig(): FirebaseConfig {
  const env = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}) as Record<string, string | undefined>;

  const apiKey = env.VITE_FIREBASE_API_KEY || "AIzaSyDummyDevApiKeyForBuild123456789";
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || "atlas-tuition.firebaseapp.com";
  const projectId = env.VITE_FIREBASE_PROJECT_ID || "atlas-tuition";
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || "atlas-tuition.appspot.com";
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012";
  const appId = env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef123456";
  const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  const config = getValidatedFirebaseConfig();
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);

  // Set browser local persistence for Auth
  if (typeof window !== "undefined") {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      logger.warn("Could not set Auth persistence", { error: err });
    });

    // Offline IndexedDb persistence for Firestore
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        logger.debug("Multiple tabs open, offline persistence enabled in first tab only.");
      } else if (err.code === "unimplemented") {
        logger.debug("Browser does not support offline IndexedDB persistence.");
      }
    });
  }

  logger.info("Firebase initialized successfully", { projectId: config.projectId });
} catch (error) {
  logger.error("Failed to initialize Firebase", error);
  throw error;
}

export { app, auth, db };
