import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banner,
  buttonClasses,
  ButtonLink,
  EmptyState,
  KpiTile,
  PageHeader,
  Stepper,
  Table,
  type TableColumn,
} from "@/components/ui";
import { IconUsers } from "@/components/ui/icons";
import { interpolate, t } from "@/i18n";
import { api } from "@/lib/api";
import type { PayrollLine, PayrollStatus } from "@/lib/api/contracts";
import { currentPeriod } from "@/lib/clock";
import {
  formatCount,
  formatDate,
  formatNumber,
  formatPeriod,
  formatTenge,
  monthName,
} from "@/lib/format";
import { isSupportedPeriod, parsePeriod } from "@/lib/period";
import { supportedYears } from "@/lib/payroll";
import { requireSession } from "@/lib/session";
import { SubmitButton } from "./SubmitButton";

const p = t.app.payroll;

const STEP: Record<PayrollStatus, number> = {
  draft: 0,
  calculated: 1,
  awaiting_approval: 2,
  approved: 2,
  paid: 3,
  closed: 4,
};

const cell = (n: number) => formatNumber(n);

export async function PayrollView({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireSession(["accountant", "owner"]);
  const sp = await searchParams;
  const period = isSupportedPeriod(sp.period, supportedYears()) ? sp.period : currentPeriod();
  const [run, employees, company] = await Promise.all([
    api.payroll.get(period),
    api.employees.list(),
    api.company.get(),
  ]);
  // Новая компания: сначала реквизиты и сотрудники
  if (!company.onboarded && session.role === "accountant") redirect("/onboarding");
  const { year, monthIndex } = parsePeriod(period);
  const month = `${monthName(monthIndex)} ${year}`;
  const totals = run.totals;

  const header = (
    <PageHeader
      meta={interpolate(p.meta, {
        count: formatCount(run.lines.length, t.plural.employees),
        period: formatPeriod(run.periodStart, run.periodEnd),
      })}
      title={interpolate(p.title, { month })}
      actions={
        run.lines.length > 0 && (
          <>
            <a
              href={`/api/export/1c?period=${period}`}
              download
              className={buttonClasses({ variant: "secondary" })}
            >
              {p.export1c}
            </a>
            {session.role === "accountant" && (
              <SubmitButton
                period={period}
                net={formatTenge(totals.net)}
                budget={formatTenge(totals.toBudget)}
                state={
                  run.status === "calculated"
                    ? "ready"
                    : run.status === "draft"
                      ? "unavailable"
                      : "submitted"
                }
              />
            )}
          </>
        )
      }
    />
  );

  if (run.lines.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<IconUsers size={26} />}
          title={p.empty.title}
          action={<ButtonLink href="/app/employees">{p.empty.action}</ButtonLink>}
        >
          {p.empty.text}
        </EmptyState>
      </>
    );
  }

  const bannerText =
    run.status === "awaiting_approval"
      ? p.banner.awaiting
      : run.status === "approved"
        ? p.banner.approved
        : p.banner.calculated;

  const columns: TableColumn<PayrollLine>[] = [
    {
      key: "name",
      header: p.table.employee,
      render: (l) => (
        <>
          <Link
            href={`/app/employees/${l.employeeId}`}
            className="font-semibold text-ink no-underline is-hover:underline"
          >
            {l.shortName}
          </Link>
          <div className="text-caption text-muted">
            {[
              l.position,
              l.isNew && p.table.isNew,
              l.workedDays < l.normDays &&
                interpolate(p.table.partial, { worked: l.workedDays, norm: l.normDays }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </>
      ),
      footer: p.table.total,
    },
    {
      key: "salary",
      header: p.table.salary,
      align: "right",
      render: (l) => cell(l.gross),
      footer: cell(totals.gross),
    },
    {
      key: "opv",
      header: p.table.opv,
      align: "right",
      render: (l) => cell(l.employee.opv),
      footer: cell(totals.opv),
    },
    {
      key: "vosms",
      header: p.table.vosms,
      align: "right",
      render: (l) => cell(l.employee.vosms),
      footer: cell(totals.vosms),
    },
    {
      key: "ipn",
      header: p.table.ipn,
      align: "right",
      render: (l) => cell(l.employee.ipn),
      footer: cell(totals.ipn),
    },
    {
      key: "net",
      header: p.table.net,
      align: "right",
      emphasis: true,
      render: (l) => cell(l.net),
      footer: cell(totals.net),
    },
  ];

  const noDeduction = employees
    .filter((e) => !e.hasDeduction && run.lines.some((l) => l.employeeId === e.id))
    .map((e) => e.shortName);

  return (
    <>
      {header}
      <Stepper steps={[...p.steps]} current={STEP[run.status]} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <KpiTile tone="ink" label={p.kpi.toPay} value={totals.net} />
        <KpiTile
          label={p.kpi.taxes}
          value={totals.toBudget}
          hint={interpolate(p.kpi.taxesHint, {
            withheld: formatNumber(totals.withheld),
            employer: formatNumber(totals.employer),
          })}
        />
        <KpiTile label={p.kpi.cost} value={totals.cost} />
      </div>
      {run.status !== "closed" && run.status !== "paid" && (
        <Banner
          tone="warning"
          title={interpolate(p.banner.title, {
            month: monthName(monthIndex),
            date: formatDate(run.taxDueDate, "dayMonth"),
          })}
        >
          {bannerText}
        </Banner>
      )}
      <Table
        caption={`${p.table.caption}, ${month}`}
        columns={columns}
        rows={run.lines}
        rowKey={(l) => l.employeeId}
        footer
      />
      <p className="text-caption text-muted">
        {interpolate(p.footnote, { year })}
        {noDeduction.length > 0 &&
          ` ${interpolate(p.footnoteNoDeduction, { names: noDeduction.join(", ") })}`}
      </p>
    </>
  );
}
