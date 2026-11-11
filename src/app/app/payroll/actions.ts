"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { Role } from "@/lib/api/contracts";
import { toActionError, type ActionResult } from "@/lib/actions";
import { isPeriod } from "@/lib/period";
import { requireSession } from "@/lib/session";

/** Общий каркас: права, проверка периода, вызов, пересчёт всех экранов. */
async function run(
  roles: Role[],
  period: string,
  fn: (period: string) => Promise<unknown>,
): Promise<ActionResult> {
  await requireSession(roles);
  if (!isPeriod(period)) return { ok: false, error: "period" };
  try {
    await fn(period);
    // refresh() в production-сборке с cacheComponents не перерисовывал экран;
    // revalidatePath пересчитывает все экраны (панель, владелец, сотрудник) в ответе на action
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

/** Бухгалтер отправляет расчёт владельцу. */
export async function submitPayrollAction(period: string): Promise<ActionResult> {
  return run(["accountant"], period, api.payroll.submit);
}

/** Владелец подтверждает выплату прямо в панели. */
export async function approvePayrollInPanelAction(period: string): Promise<ActionResult> {
  return run(["owner"], period, api.payroll.approve);
}

/** Деньги переведены сотрудникам. */
export async function markPayrollPaidAction(period: string): Promise<ActionResult> {
  return run(["accountant", "owner"], period, api.payroll.markPaid);
}

/** Вернуть расчёт на доработку, пока не выплачено. */
export async function reopenPayrollAction(period: string): Promise<ActionResult> {
  return run(["accountant", "owner"], period, api.payroll.reopen);
}
