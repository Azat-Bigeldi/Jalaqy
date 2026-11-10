import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/firebase/admin";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { parseLoginContact } from "@/lib/validation/contact";
import { ApiError, type JalaqyApi } from "../client";
import { mockApi } from "../mock";
import { v, validation } from "../mock/core";
import { runWithDb } from "../mock/db";
import { findUserByContact, firebaseAuth } from "./auth";
import { loadCompany, saveCompany, snapshot } from "./store";

/**
 * Реализация API на Firestore. Логика (расчёт, проверки, статусы) — та же,
 * что в моке; данные — компании из сессии. Каждый вызов — одна транзакция:
 * загрузили компанию, выполнили метод, сохранили изменения.
 */
async function companySession() {
  // Данные из базы — всегда на момент запроса, не при пререндере
  await connection();
  const session = await getSession();
  if (!session) throw new ApiError({ code: "unauthorized", message: "unauthorized" }, 401);
  return session;
}

/** Методы, которые только читают: им не нужна транзакция. */
const READS = new Set([
  "company.get",
  "company.users",
  "employees.list",
  "employees.get",
  "employees.payslips",
  "employees.payslip",
  "employees.certificates",
  "payroll.get",
  "payroll.export1c",
  "timesheet.get",
  "timesheet.absences",
  "taxes.payments",
  "taxes.paymentOrder",
  "taxes.reports",
  "contracts.list",
  "contracts.templates",
]);

function inCompany<A extends unknown[], R>(fn: (...args: A) => Promise<R>, readOnly = false) {
  return async (...args: A): Promise<R> => {
    const session = await companySession();
    if (readOnly) {
      const loaded = await loadCompany(null, session.companyId);
      if (!loaded) throw new ApiError({ code: "not_found", message: "company not found" }, 404);
      return runWithDb(loaded.state, () => fn(...args));
    }
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

function wrapGroup<G extends Record<string, (...args: never[]) => Promise<unknown>>>(
  groupName: string,
  group: G,
): G {
  return Object.fromEntries(
    Object.entries(group).map(([name, fn]) => [
      name,
      inCompany(fn as (...args: unknown[]) => Promise<unknown>, READS.has(`${groupName}.${name}`)),
    ]),
  ) as unknown as G;
}

const company = wrapGroup("company", mockApi.company);

/** Управлять пользователями может только бухгалтер или владелец своей компании. */
async function requireStaff() {
  const session = await companySession();
  if (session.role === "employee") {
    throw new ApiError({ code: "forbidden", message: "forbidden" }, 403);
  }
  return session;
}

export const firebaseApi: JalaqyApi = {
  auth: firebaseAuth,
  company: {
    ...company,
    async inviteUser(input) {
      const session = await requireStaff();
      // почта или телефон входа уникальны во всех компаниях
      const parsed = parseLoginContact(input.contact);
      if (parsed && (await findUserByContact(parsed.value))) {
        validation({ contact: v.contactTaken });
      }
      // проверки (имя, роль, сотрудник, пароль) — в общей логике; документ пишет saveCompany
      const user = await company.inviteUser(input);
      const docId = `${session.companyId}-${user.id}`;
      await db()
        .collection("users")
        .doc(docId)
        .update({ passwordHash: await hashPassword(input.password) });
      return { ...user, id: docId };
    },
    async setUserPassword(userId, password) {
      await requireStaff();
      // общая логика проверит, что пользователь из этой компании, и длину пароля
      await company.setUserPassword(userId, password);
      await db()
        .collection("users")
        .doc(userId)
        .update({ passwordHash: await hashPassword(password) });
    },
    async setUserRole(userId, role) {
      await requireStaff();
      return company.setUserRole(userId, role);
    },
  },
  employees: wrapGroup("employees", mockApi.employees),
  payroll: wrapGroup("payroll", mockApi.payroll),
  timesheet: wrapGroup("timesheet", mockApi.timesheet),
  taxes: wrapGroup("taxes", mockApi.taxes),
  contracts: wrapGroup("contracts", mockApi.contracts),
};
