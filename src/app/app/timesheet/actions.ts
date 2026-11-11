"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { AbsenceType } from "@/lib/api/contracts";
import { str, toActionError, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/session";

export async function decideAbsenceAction(
  id: string,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.timesheet.decideAbsence(id, decision);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export type AbsenceFormState = ActionResult | null;

export async function createAbsenceAction(
  _prev: AbsenceFormState,
  form: FormData,
): Promise<AbsenceFormState> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.timesheet.createAbsence({
      employeeId: str(form, "employeeId"),
      type: str(form, "type") as AbsenceType,
      from: str(form, "from"),
      to: str(form, "to"),
      comment: str(form, "comment") || undefined,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAbsenceAction(id: string): Promise<ActionResult> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.timesheet.deleteAbsence(id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
