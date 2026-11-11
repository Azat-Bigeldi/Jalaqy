import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Banner, Card, PageHeader, Table, type TableColumn } from "@/components/ui";
import { interpolate, t } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import type { PayrollLine, PayslipSummary } from "@/lib/api/contracts";
import { currentPeriod, today } from "@/lib/clock";
import { formatDate, formatNumber, formatPeriod, formatTenge, monthName } from "@/lib/format";
import { parsePeriod } from "@/lib/period";
import { requireSession } from "@/lib/session";
import { AbsenceStatusBadge, PayrollStatusBadge } from "../../_components/StatusBadges";
import { EditEmployeeForm } from "./EditEmployeeForm";
import { ManageEmployee } from "./ManageEmployee";

const c = t.employees.card;

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: ReactNode;
  value: number;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-divider py-2.5 first:border-t-0">
      <span className="flex flex-col">
        <span className={strong ? "font-semibold" : "text-muted"}>{label}</span>
        {hint && <span className="text-xs text-muted tabular-nums">{hint}</span>}
      </span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{formatTenge(value)}</span>
    </div>
  );
}

function MonthCard({ line, month }: { line: PayrollLine; month: string }) {
  const base = (n: number) => interpolate(c.base, { base: formatNumber(n) });
  const minus = (n: number) => -n;
  return (
    <Card as="section" aria-labelledby="emp-month" padding="lg" className="flex flex-col gap-3">
      <h2 id="emp-month" className="font-display text-xl font-bold tracking-display">
        {interpolate(c.month, { month })}
      </h2>
      <div className="flex flex-col text-body">
        <Row
          label={c.gross}
          value={line.gross}
          strong
          hint={interpolate(c.worked, { worked: line.workedDays, norm: line.normDays })}
        />
        <Row label={c.opv} value={minus(line.employee.opv)} hint={base(line.bases.opv)} />
        <Row label={c.vosms} value={minus(line.employee.vosms)} hint={base(line.bases.vosms)} />
        <Row label={c.ipn} value={minus(line.employee.ipn)} hint={base(line.bases.ipn)} />
        <div className="flex items-baseline justify-between border-t border-divider pt-3">
          <span className="font-bold">{c.net}</span>
          <span className="font-display text-2xl font-extrabold tracking-display tabular-nums">
            {formatTenge(line.net)}
          </span>
        </div>
      </div>
      <div className="on-ink flex flex-col gap-1 rounded-card bg-ink p-4 text-body text-on-ink">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-on-ink-soft">{c.employerTitle}</span>
          <span className="font-display text-xl font-extrabold text-accent tabular-nums">
            {formatTenge(line.employer.total)}
          </span>
        </div>
        <p className="text-sm text-on-ink-muted tabular-nums">
          {c.opvr} {formatNumber(line.employer.opvr)} · {c.so} {formatNumber(line.employer.so)} ·{" "}
          {c.oosms} {formatNumber(line.employer.oosms)} · {c.socialTax}{" "}
          {formatNumber(line.employer.socialTax)}
        </p>
        <div className="mt-1 flex justify-between border-t border-ink-divider pt-2">
          <span>{c.cost}</span>
          <b className="tabular-nums">{formatTenge(line.cost)}</b>
        </div>
      </div>
    </Card>
  );
}

const historyColumns: TableColumn<PayslipSummary>[] = [
  {
    key: "period",
    header: c.period,
    render: (p) => (
      <Link
        href={`/app/payroll?period=${p.period}`}
        className="font-semibold text-ink no-underline is-hover:underline"
      >
        {formatDate(`${p.period}-01`, "monthYear")}
      </Link>
    ),
  },
  { key: "gross", header: c.gross, align: "right", render: (p) => formatNumber(p.gross) },
  { key: "withheld", header: c.withheld, align: "right", render: (p) => formatNumber(p.withheld) },
  { key: "net", header: c.net, align: "right", emphasis: true, render: (p) => formatNumber(p.net) },
  {
    key: "status",
    header: c.status,
    render: (p) => <PayrollStatusBadge status={p.status} paidAt={p.paidAt} />,
  },
];

export async function EmployeeView({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(["accountant", "owner"]);
  const { id } = await params;
  const period = currentPeriod();
  let data;
  try {
    data = await Promise.all([
      api.employees.get(id),
      api.employees.payslips(id),
      api.payroll.get(period),
      api.timesheet.absences({ employeeId: id }),
    ]);
  } catch (e) {
    if (isApiError(e) && e.body.code === "not_found") notFound();
    throw e;
  }
  const [employee, payslips, run, absences] = data;
  const line = run.lines.find((l) => l.employeeId === id);
  const { year, monthIndex } = parsePeriod(period);

  return (
    <>
      <PageHeader
        back={{ href: "/app/employees", label: c.back }}
        title={`${employee.firstName} ${employee.lastName}`}
        meta={interpolate(c.meta, {
          position: employee.position,
          date: formatDate(employee.hireDate),
        })}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {employee.status === "dismissed" && employee.dismissDate && (
            <Banner tone="info">
              {interpolate(t.manage.employees.dismissedOn, {
                date: formatDate(employee.dismissDate),
              })}
            </Banner>
          )}
          <EditEmployeeForm employee={employee} readOnly={false} />
          <section aria-labelledby="emp-history" className="flex flex-col gap-3">
            <h2 id="emp-history" className="font-display text-xl font-bold tracking-display">
              {c.history}
            </h2>
            <Table
              caption={c.historyCaption}
              columns={historyColumns}
              rows={payslips}
              rowKey={(p) => p.period}
              minWidth={620}
            />
          </section>
          <ManageEmployee
            id={employee.id}
            name={`${employee.firstName} ${employee.lastName}`}
            dismissed={employee.status === "dismissed"}
            defaultDate={today()}
            minDate={employee.hireDate}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {line && <MonthCard line={line} month={`${monthName(monthIndex)} ${year}`} />}
          <Card as="section" aria-labelledby="emp-abs" padding="lg" className="flex flex-col gap-3">
            <h2 id="emp-abs" className="font-display text-xl font-bold tracking-display">
              {c.absences}
            </h2>
            <div className="flex items-baseline justify-between gap-3 rounded-button bg-paper px-3 py-2.5 text-body">
              <span className="text-muted">{c.vacationLeft}</span>
              <b className="tabular-nums">
                {interpolate(c.vacationDays, { days: employee.vacationDaysLeft })}
              </b>
            </div>
            {absences.length === 0 ? (
              <p className="text-body text-muted">{c.noAbsences}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {absences.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-divider py-2.5 first:border-t-0"
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold">{t.domain.absenceTypes[a.type]}</span>
                      <span className="text-sm text-muted">{formatPeriod(a.from, a.to)}</span>
                    </span>
                    <AbsenceStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
