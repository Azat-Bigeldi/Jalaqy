import { unstable_rethrow } from "next/navigation";
import { t } from "@/i18n";
import { isApiError } from "@/lib/api/client";

/** Ответ Server Action для форм: успех или ошибка с подсветкой полей. */
export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; fields?: Record<string, string> };

export const initialResult: ActionResult<never> | null = null;

/** Ошибку API превращаем в понятный ответ формы; неожиданные — логируем и прячем детали. */
export function toActionError(error: unknown): {
  ok: false;
  error: string;
  fields?: Record<string, string>;
} {
  // redirect() из слоя данных (сессия отозвана → /logout) не превращаем в ошибку формы
  unstable_rethrow(error);
  if (isApiError(error)) {
    return { ok: false, error: error.body.message, fields: error.body.fields };
  }
  console.error(error);
  return { ok: false, error: t.ui.genericError };
}

/** FormData → строка без пробелов по краям. */
export function str(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** «1 558 890» → 1558890; пусто → NaN. */
export function money(form: FormData, name: string): number {
  const digits = str(form, name).replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : Number.NaN;
}

export function bool(form: FormData, name: string): boolean {
  const v = form.get(name);
  return v === "on" || v === "true" || v === "1";
}
