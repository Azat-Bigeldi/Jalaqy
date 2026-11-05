import "server-only";
import type { JalaqyApi } from "../client";
import { mockApi } from "../mock";
import { firebaseAuth } from "./auth";

/**
 * Реализация API на Firestore. Переносим по разделам: что ещё не перенесено,
 * пока берётся из мока (раздел за разделом заменяется на Firestore).
 */
export const firebaseApi: JalaqyApi = {
  ...mockApi,
  auth: firebaseAuth,
};
