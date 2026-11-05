import { AsyncLocalStorage } from "node:async_hooks";
import { seed, type MockDb } from "./seed";

/*
 * Состояние мока живёт в памяти процесса. Через globalThis — чтобы горячая
 * перезагрузка модулей в dev не сбрасывала данные между запросами.
 *
 * Реализация на Firestore подставляет на время вызова состояние компании
 * из базы (runWithDb) — та же логика работает с данными из Firestore.
 */
const KEY = Symbol.for("jalaqy.mockDb");
type Holder = { [KEY]?: MockDb };

const scoped = new AsyncLocalStorage<MockDb>();

export function runWithDb<T>(db: MockDb, fn: () => T): T {
  return scoped.run(db, fn);
}

export function getDb(): MockDb {
  const current = scoped.getStore();
  if (current) return current;
  const g = globalThis as Holder;
  g[KEY] ??= seed();
  return g[KEY];
}

/** Вернуть демо-данные к исходным (настройки → «Сбросить демо-данные», тесты). */
export function resetDb(): void {
  (globalThis as Holder)[KEY] = seed();
}

export function nextId(prefix: string): string {
  const db = getDb();
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}
