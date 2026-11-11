import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { t } from "@/i18n";
import { api, isDemo } from "@/lib/api";
import { currentPeriod } from "@/lib/clock";
import { formatDate } from "@/lib/format";
import { supportedYears } from "@/lib/payroll";
import { parsePeriod, periodRange } from "@/lib/period";
import { requireSession } from "@/lib/session";
import { PageSkeleton } from "../_components/PageSkeleton";
import { CompanyForm } from "./CompanyForm";
import { ResetDemo } from "./ResetDemo";
import { UsersSection } from "./UsersSection";

export const metadata: Metadata = { title: t.settings.title };

/** Месяцы начала расчёта: с января этого года до текущего (плюс уже выбранный). */
function firstPeriods(selected: string): Array<{ value: string; label: string }> {
  const current = currentPeriod();
  const { year } = parsePeriod(current);
  const from = supportedYears().includes(year) ? `${year}-01` : current;
  const list = periodRange(from < selected ? from : selected, current).reverse();
  return list.map((p) => ({ value: p, label: formatDate(`${p}-01`, "monthYear") }));
}

async function SettingsView() {
  const session = await requireSession(["accountant", "owner"]);
  const [company, users, employees] = await Promise.all([
    api.company.get(),
    api.company.users(),
    api.employees.list(),
  ]);
  return (
    <>
      <PageHeader title={t.settings.title} />
      <CompanyForm company={company} firstPeriods={firstPeriods(company.firstPeriod)} />
      <UsersSection
        users={users}
        currentUserId={session.userId}
        employees={employees.map((e) => ({ id: e.id, name: `${e.lastName} ${e.firstName}` }))}
      />
      {isDemo && <ResetDemo />}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} rows={4} />}>
      <SettingsView />
    </Suspense>
  );
}
