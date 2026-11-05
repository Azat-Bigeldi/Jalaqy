import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/*
 * Подключение к Firebase с сервера (Admin SDK). Ключ сервисного аккаунта —
 * из переменных окружения; браузер в Firestore не ходит, правила там — «запретить всё».
 */

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // В .env и в Vercel ключ хранится одной строкой с «\n»
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export function db(): Firestore {
  return getFirestore(app());
}
