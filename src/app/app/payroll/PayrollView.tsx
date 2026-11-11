import Link from "next/link";
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
import { ConfirmAction } from "../_components/ConfirmAction";
import { MonthLink } from "../_components/MonthLink";
import { PayrollStatusBadge } from "../_components/StatusBadges";
import { approvePayrollInPanelAction, markPayrollPaidAction, reopenPayrollAction } from "./actions";
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
  const company = await api.company.get();
  const now = currentPeriod();
  // расчёт есть только с месяца начала работы в Jalaqy и до текущего
  const period =
    isSupportedPeriod(sp.period, supportedYears()) &&
    sp.period >= company.firstPeriod &&
    sp.period <= now
      ? sp.period
      : now;
  const [run, employees] = await Promise.all([
    api.payroll.get(period),
    api.employees.list({ withDismissed: true }),
  ]);
  const isOwner = session.role === "owner";
  const m = t.manage.payroll;
  const money = {
    net: formatTenge(run.totals.net),
    budget: formatTenge(run.totals.toBudget),
  };
  const monthNav = (
    <div className="flex items-center gap-1.5">
      <MonthLink period={period} dir={-1} disabled={period <= company.firstPeriod} />
      <MonthLink period={period} dir={1} disabled={period >= now} />
    </div>
  );
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
            {(run.status === "awaiting_approval" || run.status === "approved") && (
              <ConfirmAction
                variant="secondary"
                title={m.reopenTitle}
                text={m.reopenText}
                done={m.reopened}
                action={reopenPayrollAction.bind(null, period)}
              >
                {m.reopen}
              </ConfirmAction>
            )}
            {!isOwner && (run.status === "calculated" || run.status === "awaiting_approval") && (
              <SubmitButton
                period={period}
                net={money.net}
                budget={money.budget}
                state={run.status === "calculated" ? "ready" : "submitted"}
              />
            )}
            {isOwner && (run.status === "calculated" || run.status === "awaiting_approval") && (
              <ConfirmAction
                title={m.approveTitle}
                text={interpolate(m.approveText, money)}
                done={m.approved}
                action={approvePayrollInPanelAction.bind(null, period)}
              >
                {m.approve}
              </ConfirmAction>
            )}
            {run.status === "approved" && (
              <ConfirmAction
                title={m.markPaidTitle}
                text={interpolate(m.markPaidText, money)}
                done={m.paid}
                action={markPayrollPaidAction.bind(null, period)}
              >
                {m.markPaid}
              </ConfirmAction>
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
        {monthNav}
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
        ? isOwner
          ? m.bannerApprovedSelf
          : p.banner.approved
        : run.status === "paid"
          ? m.bannerPaid
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {monthNav}
        <span className="flex items-center gap-2 text-sm text-muted">
          {m.statusLabel}
          <PayrollStatusBadge status={run.status} paidAt={run.paidAt} />
        </span>
      </div>
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
      {run.status !== "closed" && (
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
