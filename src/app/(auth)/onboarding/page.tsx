import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { logoutAction } from "@/app/(auth)/actions";
import { t } from "@/i18n";
import { api, isDemo } from "@/lib/api";
import { currentPeriod, today } from "@/lib/clock";
import { formatDate } from "@/lib/format";
import { supportedYears } from "@/lib/payroll";
import { parsePeriod, periodRange } from "@/lib/period";
import { requireSession } from "@/lib/session";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = { title: t.auth.onboarding.title };

/** Месяцы, с которых можно начать расчёт: с января этого года (если на него есть ставки) до текущего. */
function firstPeriodOptions(): Array<{ value: string; label: string }> {
  const current = currentPeriod();
  const { year } = parsePeriod(current);
  const from = supportedYears().includes(year) ? `${year}-01` : current;
  return periodRange(from, current)
    .reverse()
    .map((p) => ({ value: p, label: formatDate(`${p}-01`, "monthYear") }));
}

async function Wizard() {
  await connection();
  let companyName = "";
  // С базой онбординг заполняет компанию того, кто вошёл: без входа — на вход
  if (!isDemo) {
    await requireSession(["accountant", "owner"]);
    const company = await api.company.get();
    if (company.onboarded) redirect("/app/payroll");
    companyName = company.name;
  }
  return (
    <>
      <OnboardingWizard
        defaultHireDate={today()}
        companyName={companyName}
        firstPeriods={firstPeriodOptions()}
        defaultFirstPeriod={currentPeriod()}
      />
      {!isDemo && (
        <form action={logoutAction} className="flex justify-center">
          <button type="submit" className="min-h-11 text-body font-semibold text-muted underline">
            {t.manage.onboarding.logout}
          </button>
        </form>
      )}
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
