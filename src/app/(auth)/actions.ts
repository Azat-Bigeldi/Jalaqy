"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { Role } from "@/lib/api/contracts";
import { toActionError, str } from "@/lib/actions";
import { clearSession, setSession } from "@/lib/session";
import { canAccess, homeFor, safeNext } from "@/lib/session-codec";

/** Успешный вход уводит редиректом, поэтому состояние — только ошибка. */
export type LoginState = (ReturnType<typeof toActionError> & { contact: string }) | null;

const ROLES: Role[] = ["accountant", "owner", "employee"];

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const role = str(form, "role") as Role;
  const contact = str(form, "contact");
  let destination: string;
  try {
    const session = await api.auth.login({
      contact,
      password: String(form.get("password") ?? ""),
      demoRole: ROLES.includes(role) ? role : "accountant",
    });
    await setSession(session);
    const next = safeNext(str(form, "next"));
    destination = next && canAccess(session.role, next) ? next : homeFor(session.role);
  } catch (e) {
    // контакт возвращаем в форму, пароль — нет
    return { ...toActionError(e), contact };
  }
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
