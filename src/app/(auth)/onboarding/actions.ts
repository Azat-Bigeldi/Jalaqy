"use server";

import { redirect } from "next/navigation";
import { api, isDemo } from "@/lib/api";
import type { OnboardingInput } from "@/lib/api/contracts";
import { toActionError, type ActionResult } from "@/lib/actions";
import { requireSession, setSession } from "@/lib/session";

/** Сохранить компанию и сотрудников, войти бухгалтером и открыть расчёт. */
export async function finishOnboardingAction(input: OnboardingInput): Promise<ActionResult> {
  // С базой настраивать компанию может только тот, кто в неё вошёл
  if (!isDemo) await requireSession(["accountant", "owner"]);
  try {
    const company = await api.company.onboard(input);
    // В моке новая компания заменяет демо-компанию и входим бухгалтером.
    // С базой онбординг заполняет компанию того, кто уже вошёл: сессия не меняется
    if (isDemo) {
      await setSession({
        userId: "u-acc",
        role: "accountant",
        name: company.name,
        companyId: company.id,
      });
    }
  } catch (e) {
    return toActionError(e);
  }
  redirect("/app/payroll");
}
