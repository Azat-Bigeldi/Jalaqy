import {
  calculateEmployee,
  getRates,
  prorateSalary,
  sumPayroll,
  workingDays,
  EMPTY_YTD,
  type YearToDate,
} from "@/lib/payroll";
import {
  dayOf,
  maxDate,
  minDate,
  parsePeriod,
  periodEnd,
  periodOf,
  periodStart,
  shiftPeriod,
} from "@/lib/period";
import type {
  Absence,
  Employee,
  PayrollChange,
  PayrollLine,
  PayrollRun,
  PayrollStatus,
  Period,
  PayslipSummary,
} from "../contracts";
import { currentPeriod } from "@/lib/clock";
import type { MockDb } from "./seed";

/** Оклад, действующий на дату (последнее изменение не позже даты). */
export function salaryAt(employee: Employee, date: string): number | null {
  let salary: number | null = null;
  for (const change of employee.salaryHistory) {
    if (change.from <= date) salary = change.salary;
  }
  return salary;
}

/** Работал ли сотрудник хотя бы день в периоде. */
export function isEmployedIn(employee: Employee, period: Period): boolean {
  if (employee.hireDate > periodEnd(period)) return false;
  if (employee.status !== "dismissed") return true;
  // уволенный остаётся в расчётах до месяца увольнения включительно
  return employee.dismissDate !== undefined && employee.dismissDate >= periodStart(period);
}

/** Рабочие дни отсутствия без содержания внутри периода. */
function unpaidDays(absences: Absence[], employeeId: string, period: Period): number {
  const { year, monthIndex } = parsePeriod(period);
  const start = periodStart(period);
  const end = periodEnd(period);
  return absences
    .filter(
      (a) =>
        a.employeeId === employeeId &&
        a.type === "unpaid" &&
        a.status === "approved" &&
        a.from <= end &&
        a.to >= start,
    )
    .reduce(
      (sum, a) =>
        sum +
        workingDays(year, monthIndex, dayOf(maxDate(a.from, start)), dayOf(minDate(a.to, end))),
      0,
    );
}

interface MonthCalc {
  normDays: number;
  workedDays: number;
  salary: number;
  gross: number;
}

/**
 * Начисление за месяц: оклад × отработанные / норма.
 * Отпуск и больничный в моке оплачиваются как рабочие дни (средний заработок — на бэкенде),
 * без содержания — вычитаются. Смена оклада внутри месяца не делится — берётся оклад на конец месяца.
 */
function monthGross(db: MockDb, employee: Employee, period: Period): MonthCalc {
  const { year, monthIndex } = parsePeriod(period);
  const normDays = workingDays(year, monthIndex);
  const salary = salaryAt(employee, periodEnd(period)) ?? 0;
  const firstDay = periodOf(employee.hireDate) === period ? dayOf(employee.hireDate) : 1;
  const lastDay =
    employee.status === "dismissed" &&
    employee.dismissDate &&
    periodOf(employee.dismissDate) === period
      ? dayOf(employee.dismissDate)
      : undefined;
  const inRange =
    lastDay !== undefined && lastDay < firstDay
      ? 0
      : workingDays(year, monthIndex, firstDay, lastDay);
  const workedDays = Math.max(0, inRange - unpaidDays(db.absences, employee.id, period));
  return { normDays, workedDays, salary, gross: prorateSalary(salary, workedDays, normDays) };
}

/** Накопленное с начала года до периода (для прогрессии ИПН). */
function ytdBefore(db: MockDb, employee: Employee, period: Period): YearToDate {
  const { year } = parsePeriod(period);
  let ytd = EMPTY_YTD;
  const rates = getRates(year);
  for (let p = `${year}-01`; p < period; p = shiftPeriod(p, 1)) {
    if (!isEmployedIn(employee, p)) continue;
    const { gross } = monthGross(db, employee, p);
    ytd = calculateEmployee({ gross, hasDeduction: employee.hasDeduction, ytd }, rates).ytdAfter;
  }
  return ytd;
}

export function payrollLine(db: MockDb, employee: Employee, period: Period): PayrollLine {
  const { year } = parsePeriod(period);
  const m = monthGross(db, employee, period);
  const r = calculateEmployee(
    { gross: m.gross, hasDeduction: employee.hasDeduction, ytd: ytdBefore(db, employee, period) },
    getRates(year),
  );
  return {
    employeeId: employee.id,
    shortName: employee.shortName,
    position: employee.position,
    isNew: periodOf(employee.hireDate) === period,
    normDays: m.normDays,
    workedDays: m.workedDays,
    salary: m.salary,
    gross: r.gross,
    employee: r.employee,
    employer: r.employer,
    net: r.net,
    cost: r.cost,
    bases: r.bases,
  };
}

function changes(db: MockDb, period: Period): PayrollChange[] {
  const prevEnd = periodEnd(shiftPeriod(period, -1));
  const end = periodEnd(period);
  const out: PayrollChange[] = [];
  for (const e of db.employees) {
    if (!isEmployedIn(e, period)) continue;
    if (e.status === "dismissed" && e.dismissDate && periodOf(e.dismissDate) === period) {
      out.push({ kind: "dismissed", employeeId: e.id, shortName: e.shortName });
      continue;
    }
    if (periodOf(e.hireDate) === period) {
      out.push({ kind: "hired", employeeId: e.id, shortName: e.shortName, position: e.position });
      continue;
    }
    const before = salaryAt(e, prevEnd);
    const after = salaryAt(e, end);
    if (before !== null && after !== null && before !== after) {
      out.push({
        kind: "salary",
        employeeId: e.id,
        shortName: e.shortName,
        from: before,
        to: after,
      });
    }
  }
  const order: Record<PayrollChange["kind"], number> = { hired: 0, salary: 1, dismissed: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Срок уплаты налогов и взносов: 25-е число следующего месяца. */
export function taxDueDate(period: Period): string {
  return `${shiftPeriod(period, 1)}-25`;
}

/** День выплаты: 5-е число следующего месяца. */
export function payDate(period: Period): string {
  return `${shiftPeriod(period, 1)}-05`;
}

/**
 * Статус расчёта. Если он ещё не менялся, месяц с сотрудниками от начала работы
 * в Jalaqy до текущего считается посчитанным — его можно отправить владельцу.
 */
export function statusOf(db: MockDb, period: Period, lineCount: number): PayrollStatus {
  const saved = db.payrollStatus[period];
  if (saved) return saved;
  return lineCount > 0 && period >= db.firstPeriod && period <= currentPeriod()
    ? "calculated"
    : "draft";
}

export function buildPayrollRun(db: MockDb, period: Period): PayrollRun {
  const employees = db.employees.filter((e) => isEmployedIn(e, period));
  const lines = employees.map((e) => payrollLine(db, e, period));
  const totals = sumPayroll(
    lines.map((l) => ({
      gross: l.gross,
      employee: l.employee,
      employer: l.employer,
      net: l.net,
      cost: l.cost,
      bases: l.bases,
      ytdAfter: EMPTY_YTD,
    })),
  );
  return {
    period,
    periodStart: periodStart(period),
    periodEnd: periodEnd(period),
    status: statusOf(db, period, lines.length),
    lines,
    totals,
    taxDueDate: taxDueDate(period),
    payDate: payDate(period),
    changes: period > db.firstPeriod ? changes(db, period) : [],
    ...db.payrollTimestamps[period],
  };
}

export function payslips(db: MockDb, employee: Employee, until: Period): PayslipSummary[] {
  const out: PayslipSummary[] = [];
  for (let p = db.firstPeriod; p <= until; p = shiftPeriod(p, 1)) {
    if (!isEmployedIn(employee, p)) continue;
    const line = payrollLine(db, employee, p);
    out.push({
      period: p,
      gross: line.gross,
      withheld: line.employee.total,
      net: line.net,
      employerTotal: line.employer.total,
      status: statusOf(db, p, 1),
      paidAt: db.payrollTimestamps[p]?.paidAt,
    });
  }
  return out.reverse();
}
