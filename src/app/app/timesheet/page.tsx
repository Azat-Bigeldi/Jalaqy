import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { interpolate, t } from "@/i18n";
import { api } from "@/lib/api";
import { currentPeriod, today } from "@/lib/clock";
import { formatCount, formatPeriod, monthName } from "@/lib/format";
import { isSupportedPeriod, parsePeriod, shiftPeriod } from "@/lib/period";
import { supportedYears } from "@/lib/payroll";
import { requireSession } from "@/lib/session";
import { PageSkeleton } from "../_components/PageSkeleton";
import { AbsenceStatusBadge } from "../_components/StatusBadges";
import { ConfirmlessButton } from "../_components/ConfirmlessButton";
import { deleteAbsenceAction } from "./actions";
import { CalendarLegend, MonthCalendar } from "./MonthCalendar";
import { MarkAbsence } from "./MarkAbsence";
import { RequestActions } from "./RequestActions";

const ts = t.timesheet;

export const metadata: Metadata = { title: ts.title };

function monthLabel(period: string) {
  const { year, monthIndex } = parsePeriod(period);
  return `${monthName(monthIndex)} ${year}`;
}

function MonthLink({ period, dir }: { period: string; dir: -1 | 1 }) {
  const target = shiftPeriod(period, dir);
  const label = `${dir < 0 ? ts.prev : ts.next}: ${monthLabel(target)}`;
  return (
    <Link
      href={`/app/timesheet?month=${target}`}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-button bg-surface text-ink no-underline is-hover:bg-success-bg"
    >
      {dir < 0 ? <IconChevronLeft /> : <IconChevronRight />}
    </Link>
  );
}

async function TimesheetView({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSession(["accountant", "owner"]);
  const { month } = await searchParams;
  const period = isSupportedPeriod(month, supportedYears()) ? month : currentPeriod();
  const [sheet, employees, pending] = await Promise.all([
    api.timesheet.get(period),
    api.employees.list({ withDismissed: true }),
    api.timesheet.absences({ status: "pending" }),
  ]);
  const names = Object.fromEntries(employees.map((e) => [e.id, e.shortName]));
  const label = monthLabel(period);

  const exceptions = sheet.worked
    .map((w) => ({
      ...w,
      name: names[w.employeeId] ?? "",
      absences: sheet.absences.filter((a) => a.employeeId === w.employeeId),
    }))
    .filter((x) => x.workedDays < sheet.normDays || x.absences.length > 0);

  return (
    <>
      <PageHeader
        title={ts.title}
        meta={interpolate(ts.meta, { norm: formatCount(sheet.normDays, t.plural.days) })}
        actions={
          <MarkAbsence
            employees={employees
              .filter((e) => e.status !== "dismissed")
              .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
            defaultDate={period === currentPeriod() ? today() : `${period}-01`}
          />
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          as="section"
          aria-labelledby="ts-month"
          padding="sm"
          className="flex flex-col gap-4 md:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <MonthLink period={period} dir={-1} />
            <h2
              id="ts-month"
              className="font-display text-xl font-bold tracking-display first-letter:uppercase"
            >
              {label}
            </h2>
            <MonthLink period={period} dir={1} />
          </div>
          <MonthCalendar
            timesheet={sheet}
            names={names}
            caption={interpolate(ts.calendarCaption, { month: label })}
          />
          <CalendarLegend />
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            as="section"
            aria-labelledby="ts-requests"
            padding="md"
            className="flex flex-col gap-3"
          >
            <h2
              id="ts-requests"
              className="text-caption font-bold tracking-[0.06em] text-muted uppercase"
            >
              {ts.requests}
            </h2>
            {pending.length === 0 ? (
              <p className="text-body text-muted">{ts.requestsEmpty}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {pending.map((a) => {
                  const days = Math.round((Date.parse(a.to) - Date.parse(a.from)) / 86_400_000) + 1;
                  const name = names[a.employeeId] ?? "";
                  return (
                    <li key={a.id} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base font-semibold">
                          {name} · {t.domain.absenceTypes[a.type].toLowerCase()}
                        </span>
                        <span className="text-sm text-muted">
                          {interpolate(ts.requestLine, {
                            period: formatPeriod(a.from, a.to),
                            days: formatCount(days, t.plural.days),
                          })}
                        </span>
                      </div>
                      <RequestActions id={a.id} name={name} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            as="section"
            aria-labelledby="ts-exceptions"
            padding="md"
            className="flex flex-col gap-3"
          >
            <h2
              id="ts-exceptions"
              className="text-caption font-bold tracking-[0.06em] text-muted uppercase"
            >
              {ts.exceptions}
            </h2>
            {exceptions.length === 0 ? (
              <p className="text-body text-muted">{ts.exceptionsEmpty}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {exceptions.map((x) => (
                  <li
                    key={x.employeeId}
                    className="flex flex-col gap-1.5 border-t border-divider py-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/app/employees/${x.employeeId}`}
                        className="font-semibold text-ink no-underline is-hover:underline"
                      >
                        {x.name}
                      </Link>
                      <span className="text-sm text-muted tabular-nums">
                        {interpolate(ts.workedLine, { worked: x.workedDays, norm: sheet.normDays })}
                      </span>
                    </div>
                    {x.absences.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          {t.domain.absenceTypes[a.type]} · {formatPeriod(a.from, a.to)}
                        </span>
                        <span className="flex items-center gap-1">
                          <AbsenceStatusBadge status={a.status} />
                          <ConfirmlessButton
                            variant="ghost"
                            action={deleteAbsenceAction.bind(null, a.id)}
                            done={t.manage.timesheet.removed}
                            label={interpolate(t.manage.timesheet.removeLabel, {
                              name: x.name,
                              period: formatPeriod(a.from, a.to),
                            })}
                          >
                            {t.manage.timesheet.remove}
                          </ConfirmlessButton>
                        </span>
                      </div>
                    ))}
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

export default function TimesheetPage({ searchParams }: PageProps<"/app/timesheet">) {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} rows={5} />}>
      <TimesheetView searchParams={searchParams as Promise<{ month?: string }>} />
    </Suspense>
  );
}
