"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { Role } from "@/lib/api/contracts";
import { bool, money, str, toActionError, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/session";

const STAFF: Role[] = ["accountant", "owner"];

export type EmployeeFormState = ActionResult<{ id: string }> | null;

export async function createEmployeeAction(
  _prev: EmployeeFormState,
  form: FormData,
): Promise<EmployeeFormState> {
  await requireSession(STAFF);
  try {
    const employee = await api.employees.create({
      firstName: str(form, "firstName"),
      lastName: str(form, "lastName"),
      position: str(form, "position"),
      salary: money(form, "salary"),
      hireDate: str(form, "hireDate"),
      iin: str(form, "iin").replace(/\s/g, ""),
      phone: str(form, "phone") || undefined,
      hasDeduction: bool(form, "hasDeduction"),
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: employee.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateEmployeeAction(
  _prev: EmployeeFormState,
  form: FormData,
): Promise<EmployeeFormState> {
  await requireSession(STAFF);
  const id = str(form, "id");
  try {
    const vacation = str(form, "vacationDaysLeft");
    await api.employees.update(id, {
      firstName: str(form, "firstName"),
      lastName: str(form, "lastName"),
      iin: str(form, "iin").replace(/\s/g, ""),
      hireDate: str(form, "hireDate"),
      vacationDaysLeft: /^\d+$/.test(vacation) ? Number(vacation) : Number.NaN,
      position: str(form, "position"),
      salary: money(form, "salary"),
      phone: str(form, "phone"),
      hasDeduction: bool(form, "hasDeduction"),
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Простое действие над сотрудником: права, вызов, пересчёт экранов. */
async function simple(fn: () => Promise<unknown>): Promise<ActionResult> {
  await requireSession(STAFF);
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function dismissEmployeeAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult | null> {
  return simple(() => api.employees.dismiss(str(form, "id"), str(form, "date")));
}

export async function restoreEmployeeAction(id: string): Promise<ActionResult> {
  return simple(() => api.employees.restore(id));
}

/** Удалить карточку и вернуться к списку. */
export async function removeEmployeeAction(id: string): Promise<ActionResult> {
  const result = await simple(() => api.employees.remove(id));
  if (!result.ok) return result;
  redirect("/app/employees");
}

export async function markCertificateReadyAction(certificateId: string): Promise<ActionResult> {
  return simple(() => api.employees.markCertificateReady(certificateId));
}
