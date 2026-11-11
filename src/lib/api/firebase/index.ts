import "server-only";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentPeriod } from "@/lib/clock";
import { db } from "@/lib/firebase/admin";
import { hashPassword, isPasswordOk, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { parseLoginContact } from "@/lib/validation/contact";
import { ApiError, type JalaqyApi } from "../client";
import type { CompanyUser, Session } from "../contracts";
import { mockApi } from "../mock";
import { v, validation } from "../mock/core";
import { runWithDb } from "../mock/db";
import { emptyCompany } from "../mock/seed";
import { findUserByContact, firebaseAuth, type UserDoc } from "./auth";
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

const forbidden = (): never => {
  throw new ApiError({ code: "forbidden", message: "forbidden" }, 403);
};

/** Методы, которые только читают: им не нужна транзакция. */
const READS = new Set([
  "company.get",
  "company.users",
  "employees.list",
  "employees.get",
  "employees.payslips",
  "employees.payslip",
  "employees.certificates",
  "employees.certificateRequests",
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

/**
 * Что доступно сотруднику: название компании и только свои данные.
 * Значение — как достать id сотрудника из аргументов (null — id не нужен).
 */
const EMPLOYEE_METHODS: Record<string, ((args: unknown[]) => unknown) | null> = {
  "company.get": null,
  "employees.get": (a) => a[0],
  "employees.payslips": (a) => a[0],
  "employees.payslip": (a) => a[0],
  "employees.certificates": (a) => a[0],
  "employees.requestCertificate": (a) => a[0],
  "timesheet.absences": (a) => (a[0] as { employeeId?: string } | undefined)?.employeeId,
  "timesheet.requestLeave": (a) => (a[0] as { employeeId?: string } | undefined)?.employeeId,
};

/** Окончательная проверка прав: сотрудник не выйдет за пределы своей карточки. */
function authorize(session: Session, method: string, args: unknown[]): void {
  if (session.role !== "employee") return;
  if (!(method in EMPLOYEE_METHODS)) forbidden();
  const idOf = EMPLOYEE_METHODS[method];
  if (idOf && idOf(args) !== session.employeeId) forbidden();
}

/**
 * Сессия живёт в cookie 14 дней, а доступ могли закрыть или поменять роль.
 * Сверяем с базой на каждом запросе: расхождение — выходим и просим войти заново.
 */
function checkStillValid(session: Session, users: CompanyUser[]): void {
  const me = users.find((u) => u.id === session.userId);
  if (!me || me.role !== session.role) redirect("/logout");
}

function inCompany<A extends unknown[], R>(
  method: string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  const readOnly = READS.has(method);
  return async (...args: A): Promise<R> => {
    const session = await companySession();
    authorize(session, method, args);
    if (readOnly) {
      const loaded = await loadCompany(null, session.companyId);
      if (!loaded) redirect("/logout");
      checkStillValid(session, loaded.state.users);
      return runWithDb(loaded.state, () => fn(...args));
    }
    return db().runTransaction(async (tx) => {
      const loaded = await loadCompany(tx, session.companyId);
      if (!loaded) return redirect("/logout");
      checkStillValid(session, loaded.state.users);
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
      inCompany(`${groupName}.${name}`, fn as (...args: unknown[]) => Promise<unknown>),
    ]),
  ) as unknown as G;
}

const company = wrapGroup("company", mockApi.company);
const employees = wrapGroup("employees", mockApi.employees);

const users = () => db().collection("users");

/** Свой профиль: userId обязан совпадать с сессией. */
async function ownUser(userId: string) {
  const session = await companySession();
  if (session.userId !== userId) forbidden();
  const snap = await users().doc(userId).get();
  const data = snap.data() as UserDoc | undefined;
  if (!data || data.companyId !== session.companyId) redirect("/logout");
  return { ref: snap.ref, data };
}

const toCompanyUser = (id: string, u: UserDoc): CompanyUser => ({
  id,
  name: u.name,
  contact: u.contact,
  role: u.role,
  ...(u.employeeId ? { employeeId: u.employeeId } : {}),
  status: u.status,
});

export const firebaseApi: JalaqyApi = {
  auth: {
    ...firebaseAuth,
    async register(input) {
      await connection();
      const errors: Record<string, string> = {};
      const parsed = parseLoginContact(input.contact);
      if (!input.companyName.trim()) errors.companyName = v.companyName;
      if (!input.name.trim()) errors.name = v.name;
      if (!parsed) errors.contact = v.contact;
      if (!isPasswordOk(input.password)) errors.password = v.password;
      if (Object.keys(errors).length) validation(errors);
      // почта или телефон входа уникальны во всех компаниях
      if (await findUserByContact(parsed!.value)) validation({ contact: v.contactTaken });

      const companyId = `c${randomBytes(5).toString("hex")}`;
      const userId = `${companyId}-u${randomBytes(4).toString("hex")}`;
      const state = emptyCompany(companyId, input.companyName.trim(), currentPeriod());
      const batch = db().batch();
      batch.set(db().collection("companies").doc(companyId), {
        firstPeriod: state.firstPeriod,
        company: state.company,
        payrollStatus: state.payrollStatus,
        payrollTimestamps: state.payrollTimestamps,
        paidTaxes: state.paidTaxes,
        reports: state.reports,
        seq: state.seq,
      });
      batch.set(users().doc(userId), {
        name: input.name.trim(),
        contact: parsed!.value,
        role: "owner",
        companyId,
        status: "active",
        passwordHash: await hashPassword(input.password),
      } satisfies UserDoc);
      await batch.commit();
      return { userId, role: "owner", name: input.name.trim(), companyId };
    },
  },
  account: {
    async get(userId) {
      const { data } = await ownUser(userId);
      return toCompanyUser(userId, data);
    },
    async update(userId, patch) {
      const { ref, data } = await ownUser(userId);
      const name = patch.name.trim();
      if (!name) validation({ name: v.name });
      // имя сотрудника берётся из его карточки
      if (data.role === "employee") return toCompanyUser(userId, data);
      await ref.update({ name });
      return toCompanyUser(userId, { ...data, name });
    },
    async changePassword(userId, current, next) {
      const { ref, data } = await ownUser(userId);
      if (!(await verifyPassword(current, data.passwordHash))) {
        validation({ current: v.passwordCurrent });
      }
      if (!isPasswordOk(next)) validation({ next: v.password });
      await ref.update({ passwordHash: await hashPassword(next) });
    },
  },
  company: {
    ...company,
    async inviteUser(input) {
      const session = await companySession();
      // почта или телефон входа уникальны во всех компаниях
      const parsed = parseLoginContact(input.contact);
      if (parsed && (await findUserByContact(parsed.value))) {
        validation({ contact: v.contactTaken });
      }
      // проверки (имя, роль, сотрудник, пароль) — в общей логике; документ пишет saveCompany
      const user = await company.inviteUser(input);
      const docId = `${session.companyId}-${user.id}`;
      await users()
        .doc(docId)
        .update({ passwordHash: await hashPassword(input.password) });
      return { ...user, id: docId };
    },
    async setUserPassword(userId, password) {
      // общая логика проверит, что пользователь из этой компании, и длину пароля
      await company.setUserPassword(userId, password);
      await users()
        .doc(userId)
        .update({ passwordHash: await hashPassword(password) });
    },
    async setUserRole(userId, role) {
      const session = await companySession();
      if (userId === session.userId) {
        throw new ApiError({ code: "conflict", message: v.ownRole }, 409);
      }
      return company.setUserRole(userId, role);
    },
    async removeUser(userId) {
      const session = await companySession();
      // общая логика проверит, что пользователь из этой компании и что это не я сам
      await company.removeUser(userId, session.userId);
      await users().doc(userId).delete();
    },
  },
  employees: {
    ...employees,
    async remove(id) {
      // вход сотрудника удаляем вместе с карточкой
      const logins = (await company.users()).filter((u) => u.employeeId === id);
      await employees.remove(id);
      await Promise.all(logins.map((u) => users().doc(u.id).delete()));
    },
  },
  payroll: wrapGroup("payroll", mockApi.payroll),
  timesheet: wrapGroup("timesheet", mockApi.timesheet),
  taxes: wrapGroup("taxes", mockApi.taxes),
  contracts: wrapGroup("contracts", mockApi.contracts),
};
