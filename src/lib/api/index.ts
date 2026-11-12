import "server-only";
import { t } from "@/i18n";
import { dataMode } from "@/lib/mode";
import { ApiError, type JalaqyApi } from "./client";
import { firebaseApi } from "./firebase";
import { createHttpApi } from "./http";
import { mockApi } from "./mock";

const mode = dataMode();

/** Демо-режим (JALAQY_DEMO=1): данные из мока, вход любым паролем с выбором роли. */
export const isDemo = mode === "demo";

/** База или бэкенд подключены. false — на входе показываем, что сервис не настроен. */
export const isConfigured = mode !== "none";

/** Ничего не подключено: любой вызов — понятная ошибка, а не выдуманные данные. */
const unconfiguredApi = new Proxy({} as JalaqyApi, {
  get: () =>
    new Proxy(
      {},
      {
        get: () => () =>
          Promise.reject(new ApiError({ code: "server", message: t.ui.notConfigured }, 503)),
      },
    ),
});

/**
 * Точка входа в данные для серверных компонентов и Server Actions (см. lib/mode):
 * JALAQY_API_URL → HTTP-бэкенд; ключи Firebase → Firestore; JALAQY_DEMO=1 → мок в памяти.
 */
export const api: JalaqyApi =
  mode === "http"
    ? createHttpApi(process.env.JALAQY_API_URL!)
    : mode === "firebase"
      ? firebaseApi
      : mode === "demo"
        ? mockApi
        : unconfiguredApi;

export { ApiError, isApiError } from "./client";
export type * from "./contracts";
