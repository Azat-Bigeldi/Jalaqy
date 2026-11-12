import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { hasFirebaseKeys } from "@/lib/mode";

/*
 * Подключение к Firebase с сервера (Admin SDK). Ключ сервисного аккаунта —
 * из переменных окружения; браузер в Firestore не ходит, правила там — «запретить всё».
 */

export function isFirebaseConfigured(): boolean {
  return hasFirebaseKeys();
}

/**
 * Значение, вставленное в настройки хостинга «как в .env»: с кавычками по краям,
 * пробелами или запятой в конце (если скопировано из JSON-ключа). Убираем лишнее.
 */
export function clean(value: string): string {
  return value
    .trim()
    .replace(/,$/, "")
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .trim();
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
      projectId: clean(process.env.FIREBASE_PROJECT_ID!),
      clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL!),
      // В .env и в Vercel ключ хранится одной строкой с «\n»
      privateKey: clean(process.env.FIREBASE_PRIVATE_KEY!).replace(/\\n/g, "\n"),
    }),
  });
}

export function db(): Firestore {
  return getFirestore(app());
}
