import "server-only";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import type { JalaqyApi } from "./client";
import { firebaseApi } from "./firebase";
import { createHttpApi } from "./http";
import { mockApi } from "./mock";

/** Демо-режим: данные из мока, вход любым кодом с выбором роли. */
export const isDemo = !process.env.JALAQY_API_URL && !isFirebaseConfigured();

/**
 * Точка входа в данные для серверных компонентов и Server Actions.
 * JALAQY_API_URL задан → HTTP-бэкенд; ключи Firebase заданы → Firestore;
 * иначе — мок в памяти.
 */
export const api: JalaqyApi = process.env.JALAQY_API_URL
  ? createHttpApi(process.env.JALAQY_API_URL)
  : isFirebaseConfigured()
    ? firebaseApi
    : mockApi;

export { ApiError, isApiError } from "./client";
export type * from "./contracts";
