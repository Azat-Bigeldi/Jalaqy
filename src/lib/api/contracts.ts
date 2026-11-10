/**
 * Контракты API Jalaqy. Это источник правды для будущего бэкенда (FastAPI):
 * те же поля и enum'ы должны прийти в JSON. Суммы — целые тенге, даты — ISO.
 */
import type {
  EmployeeDeductions,
  EmployerContributions,
  PayrollBases,
  PayrollTotals,
} from "@/lib/payroll";

/** Дата без времени: «2026-10-31». */
export type ISODate = string;
/** Дата и время в UTC: «2026-11-05T09:30:00Z». */
export type ISODateTime = string;
/** Расчётный период: «2026-10». */
export type Period = string;

export type Role = "accountant" | "owner" | "employee";
export type TaxRegime = "general" | "simplified" | "retail";

/* ── Сессия ─────────────────────────────────────────── */

export interface Session {
  userId: string;
  role: Role;
  name: string;
  companyId: string;
  /** Для роли employee — id сотрудника */
  employeeId?: string;
}

export interface LoginInput {
  /** Телефон +7XXXXXXXXXX или email */
  contact: string;
  password: string;
  /** Только в демо: под какой ролью войти */
  demoRole?: Role;
}

/* ── Компания ───────────────────────────────────────── */

export interface Company {
  id: string;
  name: string;
  bin: string;
  regime: TaxRegime;
  address: string;
  /** Пройден ли онбординг */
  onboarded: boolean;
}

export type CompanyUpdate = Partial<Pick<Company, "name" | "bin" | "regime" | "address">>;

/** Кто может входить в компанию. Роль employee — сотрудник со своим кабинетом. */
export interface CompanyUser {
  id: string;
  name: string;
  contact: string;
  role: Role;
  /** Для роли employee — id сотрудника */
  employeeId?: string;
  /** invited — ещё ни разу не входил */
  status: "active" | "invited";
}

/** Роли, которые можно менять в настройках (сотрудник остаётся сотрудником). */
export type StaffRole = Exclude<Role, "employee">;

export interface InviteUserInput {
  /** Для сотрудника можно не указывать — возьмём из карточки */
  name: string;
  contact: string;
  role: Role;
  /** Обязателен для роли employee */
  employeeId?: string;
  /** Первый пароль; пользователь получает его от того, кто добавил */
  password: string;
}

/* ── Сотрудники ─────────────────────────────────────── */

export interface SalaryChange {
  from: ISODate;
  salary: number;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  /** «Мадина Ж.» */
  shortName: string;
  position: string;
  /** Текущий оклад, ₸ */
  salary: number;
  salaryHistory: SalaryChange[];
  hireDate: ISODate;
  hasDeduction: boolean;
  iin: string;
  phone: string;
  status: "active" | "invited" | "dismissed";
  /** Остаток дней отпуска */
  vacationDaysLeft: number;
}

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  position: string;
  salary: number;
  hireDate: ISODate;
  hasDeduction: boolean;
  iin: string;
  phone?: string;
}

export type EmployeeUpdate = Partial<
  Pick<EmployeeInput, "position" | "salary" | "hasDeduction" | "phone">
> & {
  /** С какой даты действует новый оклад (по умолчанию — с 1-го числа текущего месяца) */
  salaryFrom?: ISODate;
};

/* ── Табель и отпуска ───────────────────────────────── */

export type AbsenceType = "vacation" | "sick" | "unpaid";
export type AbsenceStatus = "pending" | "approved" | "rejected";

export interface Absence {
  id: string;
  employeeId: string;
  type: AbsenceType;
  from: ISODate;
  to: ISODate;
  status: AbsenceStatus;
  requestedAt: ISODateTime;
  comment?: string;
}

export interface AbsenceInput {
  employeeId: string;
  type: AbsenceType;
  from: ISODate;
  to: ISODate;
  comment?: string;
}

export interface TimesheetDay {
  date: ISODate;
  working: boolean;
  /** Праздник или перенос */
  holiday: boolean;
}

export interface Timesheet {
  period: Period;
  normDays: number;
  days: TimesheetDay[];
  absences: Absence[];
  /** Отработано дней по каждому сотруднику */
  worked: Array<{ employeeId: string; workedDays: number }>;
}

/* ── Зарплата ───────────────────────────────────────── */

/**
 * draft — табель не закрыт; calculated — расчёт готов;
 * awaiting_approval — отправлен владельцу; approved — подтверждён, к выплате;
 * paid — выплачен; closed — налоги оплачены.
 */
export type PayrollStatus =
  "draft" | "calculated" | "awaiting_approval" | "approved" | "paid" | "closed";

export interface PayrollLine {
  employeeId: string;
  shortName: string;
  position: string;
  /** Принят в этом периоде */
  isNew: boolean;
  normDays: number;
  workedDays: number;
  /** Оклад по договору */
  salary: number;
  /** Начислено за период */
  gross: number;
  employee: EmployeeDeductions;
  employer: EmployerContributions;
  net: number;
  cost: number;
  bases: PayrollBases;
}

export type PayrollChange =
  | { kind: "hired"; employeeId: string; shortName: string; position: string }
  | { kind: "salary"; employeeId: string; shortName: string; from: number; to: number }
  | { kind: "dismissed"; employeeId: string; shortName: string };

export interface PayrollRun {
  period: Period;
  periodStart: ISODate;
  periodEnd: ISODate;
  status: PayrollStatus;
  lines: PayrollLine[];
  totals: PayrollTotals;
  /** Срок уплаты налогов и взносов */
  taxDueDate: ISODate;
  /** День выплаты зарплаты */
  payDate: ISODate;
  /** Что изменилось относительно прошлого периода */
  changes: PayrollChange[];
  submittedAt?: ISODateTime;
  approvedAt?: ISODateTime;
  paidAt?: ISODateTime;
}

export interface PayslipSummary {
  period: Period;
  gross: number;
  withheld: number;
  net: number;
  employerTotal: number;
  status: PayrollStatus;
  paidAt?: ISODateTime;
}

/** Расчётный листок сотрудника за месяц. */
export interface Payslip {
  period: Period;
  status: PayrollStatus;
  payDate: ISODate;
  paidAt?: ISODateTime;
  employeeId: string;
  shortName: string;
  position: string;
  companyName: string;
  line: PayrollLine;
}

/* ── Заявки сотрудника ──────────────────────────────── */

export interface LeaveRequestInput {
  employeeId: string;
  from: ISODate;
  to: ISODate;
  comment?: string;
}

export type CertificateKind = "employment" | "income";

export interface Certificate {
  id: string;
  employeeId: string;
  kind: CertificateKind;
  purpose: string;
  status: "requested" | "ready";
  requestedAt: ISODateTime;
}

export interface CertificateInput {
  kind: CertificateKind;
  purpose: string;
}

/* ── Налоги и отчёты ────────────────────────────────── */

export type TaxKind = "ipn" | "opv" | "vosms" | "opvr" | "so" | "oosms" | "socialTax";

export interface TaxPayment {
  id: string;
  period: Period;
  kind: TaxKind;
  /** За счёт кого */
  payer: "employee" | "employer";
  amount: number;
  dueDate: ISODate;
  status: "unpaid" | "paid";
  paidAt?: ISODateTime;
}

export interface TaxReport {
  id: string;
  form: "200.00";
  /** «2026-Q3» */
  quarter: string;
  dueDate: ISODate;
  status: "not_ready" | "ready" | "submitted";
}

/* ── Договоры ───────────────────────────────────────── */

export interface ContractTemplate {
  id: string;
  kind: "employment" | "salary_change" | "vacation_order";
  available: boolean;
}

export interface Contract {
  id: string;
  employeeId: string;
  templateId: string;
  createdAt: ISODateTime;
}

/* ── Онбординг ──────────────────────────────────────── */

export interface OnboardingInput {
  company: Pick<Company, "name" | "bin" | "regime">;
  employees: EmployeeInput[];
}

/* ── Ошибки ─────────────────────────────────────────── */

/** Ошибка API: code — машинный, field — какое поле формы подсветить. */
export interface ApiErrorBody {
  code: "validation" | "not_found" | "conflict" | "forbidden" | "unauthorized" | "server";
  message: string;
  fields?: Record<string, string>;
}
