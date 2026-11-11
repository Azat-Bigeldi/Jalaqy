/**
 * Контракт HTTP API для бэкенда (FastAPI): «МЕТОД /путь» → тело запроса и ответ.
 * {id}, {period} — параметры пути. Суммы — целые тенге, даты — ISO (см. ./contracts).
 * Ошибки: статус 4xx/5xx и тело ApiErrorBody ({ code, message, fields? }).
 * http.ts типизирован этой картой: расхождение клиента и контракта не скомпилируется.
 */
import type {
  Absence,
  AbsenceInput,
  AbsenceStatus,
  Certificate,
  CertificateInput,
  Company,
  CompanyUpdate,
  CompanyUser,
  Contract,
  ContractTemplate,
  Employee,
  EmployeeInput,
  EmployeeUpdate,
  InviteUserInput,
  LeaveRequestInput,
  OnboardingInput,
  PayrollRun,
  Payslip,
  PayslipSummary,
  LoginInput,
  RegisterInput,
  Session,
  StaffRole,
  TaxPayment,
  TaxReport,
  Timesheet,
} from "./contracts";

type E<Body, Response> = { body: Body; response: Response };
type File = { filename: string; content: string };

export interface Endpoints {
  // Вход по телефону или почте и паролю; ответ ставит httpOnly-cookie сессии
  "POST /auth/login": E<LoginInput, Session>;
  "POST /auth/register": E<RegisterInput, Session>;

  // Свой профиль
  "GET /account/{id}": E<void, CompanyUser>;
  "PATCH /account/{id}": E<{ name: string }, CompanyUser>;
  "PUT /account/{id}/password": E<{ current: string; next: string }, void>;

  // Компания и пользователи
  "GET /company": E<void, Company>;
  "PATCH /company": E<CompanyUpdate, Company>;
  "POST /company/onboarding": E<OnboardingInput, Company>;
  "GET /company/users": E<void, CompanyUser[]>;
  "POST /company/users": E<InviteUserInput, CompanyUser>;
  "PATCH /company/users/{id}": E<{ role: StaffRole }, CompanyUser>;
  "PUT /company/users/{id}/password": E<{ password: string }, void>;
  "DELETE /company/users/{id}": E<void, void>;

  // Сотрудники (сотрудник с ролью employee видит только свой {id})
  "GET /employees": E<void, Employee[]>;
  "GET /employees/{id}": E<void, Employee>;
  "POST /employees": E<EmployeeInput, Employee>;
  "PATCH /employees/{id}": E<EmployeeUpdate, Employee>;
  "GET /employees/{id}/payslips": E<void, PayslipSummary[]>;
  /** {period} = ГГГГ-ММ или latest — последний подтверждённый */
  "GET /employees/{id}/payslips/{period}": E<void, Payslip>;
  "GET /employees/{id}/certificates": E<void, Certificate[]>;
  "POST /employees/{id}/certificates": E<CertificateInput, Certificate>;
  "POST /employees/{id}/dismiss": E<{ date: string }, Employee>;
  "POST /employees/{id}/restore": E<void, Employee>;
  "DELETE /employees/{id}": E<void, void>;
  "GET /certificates/requests": E<void, Certificate[]>;
  "POST /certificates/{id}/ready": E<void, Certificate>;

  // Зарплата
  "GET /payroll/{period}": E<void, PayrollRun>;
  "POST /payroll/{period}/submit": E<void, PayrollRun>;
  "POST /payroll/{period}/approve": E<void, PayrollRun>;
  "POST /payroll/{period}/paid": E<void, PayrollRun>;
  "POST /payroll/{period}/reopen": E<void, PayrollRun>;
  "GET /payroll/{period}/export/1c": E<void, File>;

  // Табель и отпуска
  "GET /timesheet/{period}": E<void, Timesheet>;
  /** query: employeeId?, status? */
  "GET /absences": E<void, Absence[]>;
  "POST /absences": E<AbsenceInput, Absence>;
  "POST /absences/{id}/decision": E<{ decision: Exclude<AbsenceStatus, "pending"> }, Absence>;
  "POST /absences/requests": E<LeaveRequestInput, Absence>;
  "DELETE /absences/{id}": E<void, void>;

  // Налоги и отчёты
  "GET /taxes/{period}/payments": E<void, TaxPayment[]>;
  "POST /taxes/payments/{id}/paid": E<void, TaxPayment>;
  "GET /taxes/payments/{id}/order": E<void, File>;
  "GET /taxes/reports": E<void, TaxReport[]>;
  "PUT /taxes/reports/{id}": E<{ submitted: boolean }, TaxReport>;

  // Договоры
  "GET /contracts": E<void, Contract[]>;
  "GET /contracts/templates": E<void, ContractTemplate[]>;
}

export type EndpointKey = keyof Endpoints;
