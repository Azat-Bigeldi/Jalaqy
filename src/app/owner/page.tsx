import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand";
import { MobileContent, MobileEyebrow, MobileFooter } from "@/components/mobile/MobileShell";
import { Avatar, Banner, ButtonLink, Card, EmptyState, Skeleton } from "@/components/ui";
import { IconUsers } from "@/components/ui/icons";
import { ConfirmAction } from "@/app/app/_components/ConfirmAction";
import { markPayrollPaidAction } from "@/app/app/payroll/actions";
import { RequestActions } from "@/app/app/timesheet/RequestActions";
import { interpolate, t } from "@/i18n";
import { api } from "@/lib/api";
import type { PayrollChange } from "@/lib/api/contracts";
import { currentPeriod } from "@/lib/clock";
import { formatCount, formatDate, formatPeriod, formatTenge, monthName } from "@/lib/format";
import { parsePeriod, shiftPeriod } from "@/lib/period";
import { requireSession } from "@/lib/session";
import { ApproveButton } from "./ApproveButton";
import { Notifications } from "./Notifications";

const o = t.mobile.owner;
const mo = t.manage.owner;

export const metadata: Metadata = { title: o.approve };

/** «Курьер» → «курьер» для середины фразы. */
const lower = (s: string) => s.charAt(0).toLocaleLowerCase("ru") + s.slice(1);

function changeText(c: PayrollChange): string {
  if (c.kind === "hired")
    return interpolate(o.hired, { name: c.shortName, position: lower(c.position) });
  if (c.kind === "dismissed") return interpolate(o.dismissed, { name: c.shortName });
  return interpolate(c.to > c.from ? o.raised : o.lowered, {
    name: c.shortName,
    salary: formatTenge(c.to),
  });
}

async function OwnerHome() {
  const session = await requireSession(["owner"]);
  const period = currentPeriod();
  const [company, run, pending, employees] = await Promise.all([
    api.company.get(),
    api.payroll.get(period),
    api.timesheet.absences({ status: "pending" }),
    api.employees.list(),
  ]);
  // Новая компания: сначала реквизиты и сотрудники
  if (!company.onboarded) redirect("/onboarding");
  const names = Object.fromEntries(employees.map((e) => [e.id, e.shortName]));
  const { monthIndex } = parsePeriod(period);
  const month = monthName(monthIndex);
  const prevMonth = monthName(parsePeriod(shiftPeriod(period, -1)).monthIndex, "genitive");
  const canApprove = run.status === "calculated" || run.status === "awaiting_approval";
  const hasLines = run.lines.length > 0;
  const totals = run.totals;

  const notifications = [
    ...(canApprove && hasLines ? [interpolate(o.ready, { month })] : []),
    ...pending.map((a) => interpolate(o.leaveRequest, { name: names[a.employeeId] ?? "" })),
  ];

  return (
    <>
      <MobileContent>
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <LogoMark tone="primary" size={28} />
            <span className="truncate text-body font-semibold">{company.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Notifications items={notifications} />
            <Link
              href="/owner/profile"
              aria-label={mo.profile}
              title={mo.profile}
              className="inline-flex size-11 items-center justify-center rounded-button no-underline"
            >
              <Avatar name={session.name} size={40} />
            </Link>
          </div>
        </div>

        {run.lines.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={26} />}
            title={mo.emptyTitle}
            headingLevel={2}
            action={<ButtonLink href="/app/employees">{mo.addEmployees}</ButtonLink>}
          >
            {interpolate(mo.emptyText, { month })}
          </EmptyState>
        ) : run.status === "draft" ? (
          <Banner tone="info" title={interpolate(mo.notReadyOwner, { month })}>
            {mo.notReadyOwnerText}
          </Banner>
        ) : (
          <Card
            tone="ink"
            radius="sheet"
            padding="none"
            className="flex flex-col gap-3.5 px-5 py-[22px]"
          >
            <div className="flex flex-col gap-1.5">
              <h1 className="text-sm font-semibold text-accent">
                {interpolate(o.ready, { month })}
              </h1>
              <div className="font-display text-amount font-extrabold tracking-display tabular-nums">
                {formatTenge(totals.net)}
              </div>
              <div className="text-sm text-on-ink-soft">
                {interpolate(o.toPay, {
                  count: formatCount(run.lines.length, t.plural.employeesDative),
                })}
              </div>
            </div>
            <div aria-hidden="true" className="h-px bg-ink-divider" />
            <div className="flex justify-between text-body">
              <span className="text-on-ink-soft">{o.taxes}</span>
              <span className="font-semibold tabular-nums">{formatTenge(totals.toBudget)}</span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-on-ink-soft">{o.cost}</span>
              <span className="font-semibold tabular-nums">{formatTenge(totals.cost)}</span>
            </div>
          </Card>
        )}

        {hasLines && run.status !== "draft" && (
          <Card
            as="section"
            aria-labelledby="own-changes"
            padding="sm"
            className="flex flex-col gap-2.5"
          >
            <MobileEyebrow id="own-changes">
              {interpolate(o.changes, { month: prevMonth })}
            </MobileEyebrow>
            {run.changes.length === 0 ? (
              <p className="text-body text-muted">{o.changesEmpty}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {run.changes.map((c) => (
                  <li
                    key={`${c.kind}-${c.employeeId}`}
                    className="flex items-start gap-2.5 text-body leading-snug"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] size-2 shrink-0 rounded-full bg-primary"
                    />
                    {changeText(c)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {pending.length > 0 && (
          <Card
            as="section"
            aria-labelledby="own-pending"
            padding="sm"
            className="flex flex-col gap-3"
          >
            <MobileEyebrow id="own-pending">{o.pending}</MobileEyebrow>
            {pending.map((a) => {
              const name = names[a.employeeId] ?? "";
              const days = Math.round((Date.parse(a.to) - Date.parse(a.from)) / 86_400_000) + 1;
              return (
                <div key={a.id} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="text-base font-semibold">
                      {interpolate(o.leaveRequest, { name })}
                    </div>
                    <div className="text-sm text-muted">
                      {interpolate(o.leaveLine, {
                        period: formatPeriod(a.from, a.to),
                        days: formatCount(days, t.plural.days),
                      })}
                    </div>
                  </div>
                  <RequestActions id={a.id} name={name} />
                </div>
              );
            })}
          </Card>
        )}

        {run.status === "approved" && (
          <Banner tone="success" title={interpolate(o.alreadyApproved, { month })}>
            {interpolate(mo.approvedText, { date: formatDate(run.payDate, "dayMonth") })}
          </Banner>
        )}
        {(run.status === "paid" || run.status === "closed") && (
          <Banner tone="success" title={interpolate(mo.paidTitle, { month })}>
            {run.status === "closed"
              ? mo.closedText
              : interpolate(mo.paidText, { date: formatDate(run.taxDueDate, "dayMonth") })}
          </Banner>
        )}
      </MobileContent>

      <MobileFooter>
        {hasLines && canApprove && <ApproveButton period={period} />}
        {hasLines && run.status === "approved" && (
          <ConfirmAction
            size="xl"
            fullWidth
            title={t.manage.payroll.markPaidTitle}
            text={interpolate(t.manage.payroll.markPaidText, { net: formatTenge(totals.net) })}
            done={t.manage.payroll.paid}
            action={markPayrollPaidAction.bind(null, period)}
          >
            {mo.markPaid}
          </ConfirmAction>
        )}
        {hasLines && run.status !== "draft" && (
          <Link href="/owner/breakdown" className="py-2.5 text-center text-body font-semibold">
            {o.details}
          </Link>
        )}
        <Link href="/app/payroll" className="py-2.5 text-center text-body font-semibold">
          {mo.openPanel}
        </Link>
      </MobileFooter>
    </>
  );
}

function OwnerSkeleton() {
  return (
    <MobileContent>
      <span className="sr-only" role="status">
        {t.ui.loading}
      </span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="size-11 rounded-button" />
      </div>
      <Skeleton className="h-48 rounded-sheet" />
      <Skeleton className="h-28 rounded-card-lg" />
      <Skeleton className="h-36 rounded-card-lg" />
    </MobileContent>
  );
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<OwnerSkeleton />}>
      <OwnerHome />
    </Suspense>
  );
}
