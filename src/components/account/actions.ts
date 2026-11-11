"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { str, toActionError, type ActionResult } from "@/lib/actions";
import { requireSession, setSession } from "@/lib/session";

export type AccountFormState = ActionResult | null;

/** Сменить своё имя: оно же показывается в меню, поэтому обновляем и сессию. */
export async function updateNameAction(
  _prev: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const session = await requireSession();
  try {
    const user = await api.account.update(session.userId, { name: str(form, "name") });
    await setSession({ ...session, name: user.name });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changePasswordAction(
  _prev: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const session = await requireSession();
  try {
    await api.account.changePassword(
      session.userId,
      String(form.get("current") ?? ""),
      String(form.get("next") ?? ""),
    );
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
