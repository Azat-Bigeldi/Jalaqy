import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSession } from "@/lib/session";
import { ApiError, type JalaqyApi } from "../client";
import { mockApi } from "../mock";
import { runWithDb } from "../mock/db";
import { firebaseAuth } from "./auth";
import { loadCompany, saveCompany, snapshot } from "./store";

/**
 * Реализация API на Firestore. Логика (расчёт, проверки, статусы) — та же,
 * что в моке; данные — компании из сессии. Каждый вызов — одна транзакция:
 * загрузили компанию, выполнили метод, сохранили изменения.
 */
function inCompany<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    // Данные из базы — всегда на момент запроса, не при пререндере
    await connection();
    const session = await getSession();
    if (!session) throw new ApiError({ code: "unauthorized", message: "unauthorized" }, 401);
    return db().runTransaction(async (tx) => {
      const loaded = await loadCompany(tx, session.companyId);
      if (!loaded) throw new ApiError({ code: "not_found", message: "company not found" }, 404);
      const before = snapshot(loaded.state);
      const result = await runWithDb(loaded.state, () => fn(...args));
      saveCompany(tx, session.companyId, loaded, before);
      return result;
    });
  };
}

function wrapGroup<G extends Record<string, (...args: never[]) => Promise<unknown>>>(group: G): G {
  return Object.fromEntries(
    Object.entries(group).map(([name, fn]) => [
      name,
      inCompany(fn as (...args: unknown[]) => Promise<unknown>),
    ]),
  ) as unknown as G;
}

export const firebaseApi: JalaqyApi = {
  auth: firebaseAuth,
  company: wrapGroup(mockApi.company),
  employees: wrapGroup(mockApi.employees),
  payroll: wrapGroup(mockApi.payroll),
  timesheet: wrapGroup(mockApi.timesheet),
  taxes: wrapGroup(mockApi.taxes),
  contracts: wrapGroup(mockApi.contracts),
};
