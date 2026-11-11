"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api, isDemo } from "@/lib/api";
import type { Role } from "@/lib/api/contracts";
import { toActionError, str } from "@/lib/actions";
import { t } from "@/i18n";
import { clearSession, setSession } from "@/lib/session";
import { canAccess, homeFor, safeNext } from "@/lib/session-codec";
import { createRateLimiter } from "@/lib/waitlist/rate-limit";

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

export type RegisterValues = { companyName: string; name: string; contact: string };
export type RegisterState = (ReturnType<typeof toActionError> & { values: RegisterValues }) | null;

/** Не больше 5 новых компаний в час с одного адреса. */
const registerLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

/** Новая компания: тот, кто регистрирует, становится владельцем и сразу входит. */
export async function registerAction(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const values: RegisterValues = {
    companyName: str(form, "companyName"),
    name: str(form, "name"),
    contact: str(form, "contact"),
  };
  const v = t.domain.validation;
  if (isDemo) redirect("/onboarding");
  // Закрытый пилот: если задан JALAQY_SIGNUP_CODE, без кода компанию не создать
  const code = process.env.JALAQY_SIGNUP_CODE;
  if (code && str(form, "code") !== code) {
    return { ok: false, error: t.ui.formErrors, fields: { code: v.signupCode }, values };
  }
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!registerLimiter.check(ip)) return { ok: false, error: v.tooMany, values };
  try {
    const session = await api.auth.register({
      ...values,
      password: String(form.get("password") ?? ""),
    });
    await setSession(session);
  } catch (e) {
    return { ...toActionError(e), values };
  }
  redirect("/onboarding");
}
