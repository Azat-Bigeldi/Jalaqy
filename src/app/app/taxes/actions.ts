"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { toActionError, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/session";

export async function markTaxPaidAction(id: string): Promise<ActionResult> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.taxes.markPaid(id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setReportSubmittedAction(
  id: string,
  submitted: boolean,
): Promise<ActionResult> {
  await requireSession(["accountant", "owner"]);
  try {
    await api.taxes.setReportSubmitted(id, submitted);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
