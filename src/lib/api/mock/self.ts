import { interpolate } from "@/i18n";
import { shiftPeriod } from "@/lib/period";
import { ApiError } from "../client";
import type { JalaqyApi } from "../client";
import type { Absence, Certificate } from "../contracts";
import { clone, findEmployee, latency, now, v, validation } from "./core";
import { getDb, nextId } from "./db";
import { buildPayrollRun, isEmployedIn, payDate, payrollLine } from "./payroll";
import { currentPeriod } from "@/lib/clock";

/** Листок виден сотруднику после подтверждения владельцем. */
const VISIBLE = new Set(["approved", "paid", "closed"]);

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/** Методы для экранов сотрудника (свои листки, отпуск, справки). */
export const self: Pick<JalaqyApi["employees"], "payslip" | "certificates" | "requestCertificate"> &
  Pick<JalaqyApi["timesheet"], "requestLeave"> = {
  async payslip(id, period) {
    await latency();
    const db = getDb();
    const employee = findEmployee(id);
    let target = period;
    if (!target) {
      for (let p = currentPeriod(); p >= db.firstPeriod; p = shiftPeriod(p, -1)) {
        if (isEmployedIn(employee, p) && VISIBLE.has(db.payrollStatus[p] ?? "")) {
          target = p;
          break;
        }
      }
    }
    if (
      !target ||
      !isEmployedIn(employee, target) ||
      !VISIBLE.has(db.payrollStatus[target] ?? "")
    ) {
      throw new ApiError({ code: "not_found", message: v.notFound }, 404);
    }
    const run = buildPayrollRun(db, target);
    return {
      period: target,
      status: run.status,
      payDate: payDate(target),
      paidAt: run.paidAt,
      employeeId: id,
      shortName: employee.shortName,
      position: employee.position,
      companyName: db.company.name,
      line: payrollLine(db, employee, target),
    };
  },

  async certificates(id) {
    await latency();
    findEmployee(id);
    return clone(
      getDb()
        .certificates.filter((c) => c.employeeId === id)
        .reverse(),
    );
  },

  async requestCertificate(id, input) {
    await latency();
    findEmployee(id);
    if (!input.purpose.trim()) validation({ purpose: v.required });
    const cert: Certificate = {
      id: nextId("cert"),
      employeeId: id,
      kind: input.kind,
      purpose: input.purpose.trim(),
      status: "requested",
      requestedAt: now(),
    };
    getDb().certificates.push(cert);
    return clone(cert);
  },

  async requestLeave(input) {
    await latency();
    const employee = findEmployee(input.employeeId);
    const errors: Record<string, string> = {};
    if (!input.from) errors.from = v.date;
    if (!input.to) errors.to = v.date;
    if (!errors.from && !errors.to && input.to < input.from) errors.to = v.dateOrder;
    if (
      !errors.from &&
      !errors.to &&
      daysBetween(input.from, input.to) > employee.vacationDaysLeft
    ) {
      errors.to = interpolate(v.vacationLimit, { days: employee.vacationDaysLeft });
    }
    if (Object.keys(errors).length) validation(errors);
    const absence: Absence = {
      id: nextId("abs"),
      employeeId: input.employeeId,
      type: "vacation",
      from: input.from,
      to: input.to,
      comment: input.comment,
      status: "pending",
      requestedAt: now(),
    };
    getDb().absences.push(absence);
    return clone(absence);
  },
};
