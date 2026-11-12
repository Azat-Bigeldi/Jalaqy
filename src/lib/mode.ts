/**
 * Откуда приложение берёт данные.
 *
 *   http     — задан JALAQY_API_URL: свой бэкенд;
 *   firebase — заданы ключи Firebase: настоящие компании в Firestore;
 *   demo     — явно включён JALAQY_DEMO=1: компания из макета в памяти, вход любым паролем.
 *              Только для разработки, тестов и скриншотов;
 *   none     — ничего не задано: приложение честно говорит, что база не подключена.
 *
 * Демо никогда не включается само: забытые на хостинге ключи не должны
 * превращать рабочий продукт в витрину с выдуманной компанией.
 */
export type DataMode = "http" | "firebase" | "demo" | "none";

type Env = Record<string, string | undefined>;

export function hasFirebaseKeys(env: Env = process.env): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

export function dataMode(env: Env = process.env): DataMode {
  if (env.JALAQY_API_URL) return "http";
  if (hasFirebaseKeys(env)) return "firebase";
  if (env.JALAQY_DEMO === "1") return "demo";
  return "none";
}
