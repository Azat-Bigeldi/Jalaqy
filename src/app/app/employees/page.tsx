import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { IconUsers } from "@/components/ui/icons";
import { interpolate, t } from "@/i18n";
import { api } from "@/lib/api";
import { today } from "@/lib/clock";
import { formatCount, formatTenge } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { PageSkeleton } from "../_components/PageSkeleton";
import { ConfirmlessButton } from "../_components/ConfirmlessButton";
import { markCertificateReadyAction } from "./actions";
import { AddEmployee } from "./AddEmployee";
import { EmployeesTable } from "./EmployeesTable";

const e = t.employees;
const me = t.manage.employees;

export const metadata: Metadata = { title: e.title };

async function EmployeesView() {
  await requireSession(["accountant", "owner"]);
  const [all, requests] = await Promise.all([
    api.employees.list({ withDismissed: true }),
    api.employees.certificateRequests(),
  ]);
  const employees = all.filter((emp) => emp.status !== "dismissed");
  const fund = employees.reduce((sum, emp) => sum + emp.salary, 0);
  const nameOf = (id: string) => {
    const emp = all.find((x) => x.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : "";
  };
  return (
    <>
      <PageHeader
        title={e.title}
        meta={interpolate(e.meta, {
          count: formatCount(employees.length, t.plural.employees),
          fund: formatTenge(fund),
        })}
        actions={<AddEmployee defaultHireDate={today()} />}
      />
      {requests.length > 0 && (
        <Card as="section" aria-labelledby="emp-certs" padding="md" className="flex flex-col gap-3">
          <h2
            id="emp-certs"
            className="text-caption font-bold tracking-[0.06em] text-muted uppercase"
          >
            {me.certificates}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {requests.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-divider py-2.5 first:border-t-0 first:pt-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {interpolate(me.certificateLine, {
                      name: nameOf(c.employeeId),
                      kind: t.mobile.certificate.kinds[c.kind].toLowerCase(),
                    })}
                  </span>
                  <span className="text-sm text-muted">{c.purpose}</span>
                </span>
                <ConfirmlessButton
                  action={markCertificateReadyAction.bind(null, c.id)}
                  done={me.certificateDone}
                  label={interpolate(me.certificateReadyLabel, { name: nameOf(c.employeeId) })}
                >
                  {me.certificateReady}
                </ConfirmlessButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {all.length === 0 ? (
        <EmptyState icon={<IconUsers size={26} />} title={e.empty.title}>
          {e.empty.text}
        </EmptyState>
      ) : (
        <EmployeesTable employees={all} />
      )}
    </>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <EmployeesView />
    </Suspense>
  );
}
