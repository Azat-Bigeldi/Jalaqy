"use server";

import { revalidatePath } from "next/cache";
import { api, isDemo } from "@/lib/api";
import type { Role, StaffRole, TaxRegime } from "@/lib/api/contracts";
import { resetDb } from "@/lib/api/mock/db";
import { str, toActionError, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/session";

export type FormState = ActionResult | null;

export async function updateCompanyAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.company.update({
      name: str(form, "name"),
      bin: str(form, "bin").replace(/\s/g, ""),
      regime: str(form, "regime") as TaxRegime,
      address: str(form, "address"),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function inviteUserAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.company.inviteUser({
      name: str(form, "name"),
      contact: str(form, "contact"),
      role: str(form, "role") as Role,
      employeeId: str(form, "employeeId") || undefined,
      password: String(form.get("password") ?? ""),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setUserPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.company.setUserPassword(str(form, "userId"), String(form.get("password") ?? ""));
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setUserRoleAction(userId: string, role: StaffRole): Promise<ActionResult> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.company.setUserRole(userId, role);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

/** Только для мока: вернуть компанию из дизайна. */
export async function resetDemoAction(): Promise<ActionResult> {
  await requireSession(["accountant", "owner"]);
  if (!isDemo) return { ok: false, error: "mock only" };
  resetDb();
  revalidatePath("/", "layout");
  return { ok: true };
}
