import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand";
import { MobileContent, MobileEyebrow, MobileFooter } from "@/components/mobile/MobileShell";
import { Banner, Card, IconButton, Skeleton } from "@/components/ui";
import { IconLogout } from "@/components/ui/icons";
import { logoutAction } from "@/app/(auth)/actions";
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
  await requireSession(["owner"]);
  const period = currentPeriod();
  const [company, run, pending, employees] = await Promise.all([
    api.company.get(),
    api.payroll.get(period),
    api.timesheet.absences({ status: "pending" }),
    api.employees.list(),
  ]);
  const names = Object.fromEntries(employees.map((e) => [e.id, e.shortName]));
  const { monthIndex } = parsePeriod(period);
  const month = monthName(monthIndex);
  const prevMonth = monthName(parsePeriod(shiftPeriod(period, -1)).monthIndex, "genitive");
  const canApprove = run.status === "calculated" || run.status === "awaiting_approval";
  const approved = run.status === "approved" || run.status === "paid" || run.status === "closed";
  const totals = run.totals;

  const notifications = [
    ...(canApprove ? [interpolate(o.ready, { month })] : []),
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
          <div className="flex items-center gap-1">
            <Notifications items={notifications} />
            <form action={logoutAction}>
              <IconButton
                type="submit"
                variant="ghost"
                label={t.ui.logout}
                icon={<IconLogout size={20} />}
              />
            </form>
          </div>
        </div>

        {run.status === "draft" ? (
          <Banner tone="info" title={interpolate(o.notReady, { month })}>
            {o.notReadyText}
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

        {run.status !== "draft" && (
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

        {approved && (
          <Banner tone="success" title={interpolate(o.alreadyApproved, { month })}>
            {interpolate(o.alreadyApprovedText, { date: formatDate(run.payDate, "dayMonth") })}
          </Banner>
        )}
      </MobileContent>

      {run.status !== "draft" && (
        <MobileFooter>
          {canApprove && <ApproveButton period={period} />}
          <Link href="/owner/breakdown" className="py-2.5 text-center text-body font-semibold">
            {o.details}
          </Link>
        </MobileFooter>
      )}
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
