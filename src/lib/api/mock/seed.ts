import { iinCheckDigit } from "@/lib/validation/iin";
import type {
  Absence,
  Certificate,
  Company,
  CompanyUser,
  Contract,
  Employee,
  PayrollStatus,
  Period,
  TaxReport,
} from "../contracts";

/** «Сегодня» в моке: конец октября 2026 — расчёт за октябрь готов, выплата 5 ноября. */
export const MOCK_TODAY = "2026-10-30";
/** Текущий расчётный период. */
export const CURRENT_PERIOD: Period = "2026-10";
/** С какого месяца в демо есть история расчётов. */
export const FIRST_PERIOD: Period = "2026-01";

/** Достраивает 11 цифр до валидного ИИН/БИН (подбирает последнюю цифру базы, если нужно). */
export function withCheckDigit(base11: string): string {
  for (let i = 0; i < 10; i++) {
    const base = base11.slice(0, 10) + String((Number(base11[10]) + i) % 10);
    const check = iinCheckDigit(base);
    if (check !== null) return base + check;
  }
  throw new Error(`Не удалось построить ИИН из ${base11}`);
}

const shortName = (first: string, last: string) => `${first} ${last.charAt(0)}.`;

function employee(
  e: Omit<Employee, "shortName" | "salary" | "status"> & { status?: Employee["status"] },
): Employee {
  const current = e.salaryHistory[e.salaryHistory.length - 1];
  if (!current) throw new Error(`У ${e.id} нет оклада`);
  return {
    ...e,
    shortName: shortName(e.firstName, e.lastName),
    salary: current.salary,
    status: e.status ?? "active",
  };
}

export interface MockDb {
  company: Omit<Company, "firstPeriod">;
  /** С какого месяца компания ведёт расчёт в Jalaqy (история листков — отсюда) */
  firstPeriod: Period;
  users: CompanyUser[];
  employees: Employee[];
  absences: Absence[];
  payrollStatus: Record<Period, PayrollStatus>;
  payrollTimestamps: Record<Period, { submittedAt?: string; approvedAt?: string; paidAt?: string }>;
  paidTaxes: Record<string, string>;
  reports: TaxReport[];
  contracts: Contract[];
  certificates: Certificate[];
  seq: number;
}

/** Компания из design/Payroll.dc.html: 6 сотрудников, оклады как в макете. */
export function seed(): MockDb {
  const employees: Employee[] = [
    employee({
      id: "madina",
      firstName: "Мадина",
      lastName: "Жумабаева",
      position: "Управляющая",
      salaryHistory: [
        { from: "2023-03-01", salary: 450_000 },
        { from: "2025-01-01", salary: 550_000 },
      ],
      hireDate: "2023-03-01",
      hasDeduction: true,
      iin: withCheckDigit("90031540012"),
      phone: "+77012223344",
      vacationDaysLeft: 18,
    }),
    employee({
      id: "daniyar",
      firstName: "Данияр",
      lastName: "Касымов",
      position: "Старший бариста",
      salaryHistory: [
        { from: "2024-06-10", salary: 250_000 },
        { from: "2025-06-01", salary: 280_000 },
        { from: "2026-10-01", salary: 320_000 },
      ],
      hireDate: "2024-06-10",
      hasDeduction: true,
      iin: withCheckDigit("98071230045"),
      phone: "+77073334455",
      vacationDaysLeft: 14,
    }),
    employee({
      id: "asel",
      firstName: "Асель",
      lastName: "Бекова",
      position: "Кондитер",
      salaryHistory: [{ from: "2025-02-03", salary: 300_000 }],
      hireDate: "2025-02-03",
      hasDeduction: true,
      iin: withCheckDigit("95112040078"),
      phone: "+77054445566",
      vacationDaysLeft: 12,
    }),
    employee({
      id: "erlan",
      firstName: "Ерлан",
      lastName: "Тлеубаев",
      position: "Бариста",
      salaryHistory: [{ from: "2025-08-01", salary: 250_000 }],
      hireDate: "2025-08-01",
      hasDeduction: true,
      iin: withCheckDigit("01020350031"),
      phone: "+77085556677",
      vacationDaysLeft: 21,
    }),
    employee({
      id: "aigerim",
      firstName: "Айгерим",
      lastName: "Серикова",
      position: "Бариста",
      salaryHistory: [{ from: "2026-04-15", salary: 250_000 }],
      hireDate: "2026-04-15",
      hasDeduction: true,
      iin: withCheckDigit("03061560044"),
      phone: "+77476667788",
      vacationDaysLeft: 10,
    }),
    employee({
      id: "timur",
      firstName: "Тимур",
      lastName: "Ахметов",
      position: "Курьер",
      salaryHistory: [{ from: "2026-10-01", salary: 200_000 }],
      hireDate: "2026-10-01",
      hasDeduction: true,
      iin: withCheckDigit("04090830017"),
      phone: "+77017778899",
      vacationDaysLeft: 2,
    }),
  ];

  const absences: Absence[] = [
    {
      id: "abs-1",
      employeeId: "asel",
      type: "vacation",
      from: "2026-11-10",
      to: "2026-11-14",
      status: "pending",
      requestedAt: "2026-10-28T09:12:00Z",
    },
    {
      id: "abs-2",
      employeeId: "madina",
      type: "vacation",
      from: "2026-08-03",
      to: "2026-08-14",
      status: "approved",
      requestedAt: "2026-07-10T08:00:00Z",
    },
    {
      id: "abs-3",
      employeeId: "erlan",
      type: "sick",
      from: "2026-09-14",
      to: "2026-09-16",
      status: "approved",
      requestedAt: "2026-09-14T06:30:00Z",
    },
    {
      id: "abs-4",
      employeeId: "daniyar",
      type: "vacation",
      from: "2026-12-21",
      to: "2026-12-31",
      status: "approved",
      requestedAt: "2026-10-15T11:00:00Z",
    },
  ];

  const payrollStatus: Record<Period, PayrollStatus> = {};
  const payrollTimestamps: MockDb["payrollTimestamps"] = {};
  for (let m = 1; m <= 9; m++) {
    const period = `2026-${String(m).padStart(2, "0")}`;
    payrollStatus[period] = "closed";
    const next = m === 12 ? "2027-01" : `2026-${String(m + 1).padStart(2, "0")}`;
    payrollTimestamps[period] = { paidAt: `${next}-05T09:00:00Z` };
  }
  payrollStatus[CURRENT_PERIOD] = "calculated";

  return {
    firstPeriod: FIRST_PERIOD,
    company: {
      id: "tulpan",
      name: "Кофейня «Тюльпан»",
      bin: withCheckDigit("23054001234"),
      regime: "simplified",
      address: "Алматы, ул. Панфилова, 98",
      onboarded: true,
    },
    users: [
      {
        id: "u-owner",
        name: "Ержан Сейткали",
        contact: "+77011112233",
        role: "owner",
        status: "active",
      },
      {
        id: "u-acc",
        name: "Гульмира Нурланова",
        contact: "buh@tulpan.kz",
        role: "accountant",
        status: "active",
      },
      {
        id: "u-inv",
        name: "Алия Омарова",
        contact: "aliya.omarova@mail.kz",
        role: "accountant",
        status: "invited",
      },
    ],
    employees,
    absences,
    payrollStatus,
    payrollTimestamps,
    paidTaxes: {},
    reports: [
      {
        id: "200-2026-Q1",
        form: "200.00",
        quarter: "2026-Q1",
        dueDate: "2026-05-15",
        status: "submitted",
      },
      {
        id: "200-2026-Q2",
        form: "200.00",
        quarter: "2026-Q2",
        dueDate: "2026-08-15",
        status: "submitted",
      },
      {
        id: "200-2026-Q3",
        form: "200.00",
        quarter: "2026-Q3",
        dueDate: "2026-11-15",
        status: "ready",
      },
      {
        id: "200-2026-Q4",
        form: "200.00",
        quarter: "2026-Q4",
        dueDate: "2027-02-15",
        status: "not_ready",
      },
    ],
    contracts: [],
    certificates: [
      {
        id: "cert-1",
        employeeId: "daniyar",
        kind: "employment",
        purpose: "Для банка",
        status: "ready",
        requestedAt: "2026-09-02T08:00:00Z",
      },
    ],
    seq: 100,
  };
}

/** Пустая компания: создаётся скриптом firebase:company, заполняется онбордингом. */
export function emptyCompany(id: string, name: string, firstPeriod: Period): MockDb {
  return {
    firstPeriod,
    company: { id, name, bin: "", regime: "simplified", address: "", onboarded: false },
    users: [],
    employees: [],
    absences: [],
    payrollStatus: {},
    payrollTimestamps: {},
    paidTaxes: {},
    reports: [],
    contracts: [],
    certificates: [],
    seq: 100,
  };
}
