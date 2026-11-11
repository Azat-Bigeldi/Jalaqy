import type {
  Absence,
  AbsenceInput,
  AbsenceStatus,
  ApiErrorBody,
  Company,
  CompanyUpdate,
  CompanyUser,
  Contract,
  ContractTemplate,
  Employee,
  EmployeeInput,
  EmployeeUpdate,
  InviteUserInput,
  OnboardingInput,
  Payslip,
  Certificate,
  CertificateInput,
  LeaveRequestInput,
  PayrollRun,
  PayslipSummary,
  Period,
  LoginInput,
  RegisterInput,
  Session,
  StaffRole,
  TaxPayment,
  TaxReport,
  Timesheet,
} from "./contracts";

/**
 * Интерфейс API. Мок (./mock) и HTTP-клиент к FastAPI (./http) реализуют его одинаково:
 * страницы и Server Actions не знают, откуда данные.
 */
export interface JalaqyApi {
  auth: {
    /** Вход по телефону или почте и паролю */
    login(input: LoginInput): Promise<Session>;
    /** Новая компания и её владелец; сразу входим */
    register(input: RegisterInput): Promise<Session>;
  };
  /** Свой профиль: userId — из сессии */
  account: {
    get(userId: string): Promise<CompanyUser>;
    update(userId: string, patch: { name: string }): Promise<CompanyUser>;
    changePassword(userId: string, current: string, next: string): Promise<void>;
  };
  company: {
    get(): Promise<Company>;
    update(patch: CompanyUpdate): Promise<Company>;
    onboard(input: OnboardingInput): Promise<Company>;
    users(): Promise<CompanyUser[]>;
    inviteUser(input: InviteUserInput): Promise<CompanyUser>;
    setUserRole(userId: string, role: StaffRole): Promise<CompanyUser>;
    /** Задать пользователю новый пароль (забыл или первый вход) */
    setUserPassword(userId: string, password: string): Promise<void>;
    /** Закрыть вход пользователю. actorId — кто удаляет (себя удалить нельзя) */
    removeUser(userId: string, actorId: string): Promise<void>;
  };
  employees: {
    /** Без уволенных; withDismissed — вместе с ними */
    list(opts?: { withDismissed?: boolean }): Promise<Employee[]>;
    get(id: string): Promise<Employee>;
    create(input: EmployeeInput): Promise<Employee>;
    update(id: string, patch: EmployeeUpdate): Promise<Employee>;
    payslips(id: string): Promise<PayslipSummary[]>;
    /** Листок за период; без периода — последний подтверждённый */
    payslip(id: string, period?: Period): Promise<Payslip>;
    certificates(id: string): Promise<Certificate[]>;
    requestCertificate(id: string, input: CertificateInput): Promise<Certificate>;
    /** Уволить: date — последний рабочий день */
    dismiss(id: string, date: string): Promise<Employee>;
    /** Отменить увольнение */
    restore(id: string): Promise<Employee>;
    /** Удалить карточку, добавленную по ошибке (пока по ней не было подтверждённых выплат) */
    remove(id: string): Promise<void>;
    /** Заказанные справки, которые ещё не готовы (для бухгалтера) */
    certificateRequests(): Promise<Certificate[]>;
    markCertificateReady(certificateId: string): Promise<Certificate>;
  };
  payroll: {
    get(period: Period): Promise<PayrollRun>;
    /** Отправить владельцу на подтверждение */
    submit(period: Period): Promise<PayrollRun>;
    /** Владелец подтверждает выплату (из «расчёт готов» или «ждёт подтверждения») */
    approve(period: Period): Promise<PayrollRun>;
    /** Зарплата выплачена сотрудникам (после подтверждения) */
    markPaid(period: Period): Promise<PayrollRun>;
    /** Вернуть в «расчёт готов», пока не выплачено: нашли ошибку */
    reopen(period: Period): Promise<PayrollRun>;
    /** Выгрузка для 1С (CSV) */
    export1c(period: Period): Promise<{ filename: string; content: string }>;
  };
  timesheet: {
    get(period: Period): Promise<Timesheet>;
    absences(filter?: { employeeId?: string; status?: AbsenceStatus }): Promise<Absence[]>;
    createAbsence(input: AbsenceInput): Promise<Absence>;
    decideAbsence(id: string, decision: Exclude<AbsenceStatus, "pending">): Promise<Absence>;
    /** Сотрудник просит отпуск — заявка ждёт решения владельца */
    requestLeave(input: LeaveRequestInput): Promise<Absence>;
    /** Удалить отсутствие или заявку (списанные дни отпуска возвращаются) */
    deleteAbsence(id: string): Promise<void>;
  };
  taxes: {
    payments(period: Period): Promise<TaxPayment[]>;
    markPaid(id: string): Promise<TaxPayment>;
    paymentOrder(id: string): Promise<{ filename: string; content: string }>;
    reports(): Promise<TaxReport[]>;
    /** Отметить форму 200.00 сданной (или снять отметку) */
    setReportSubmitted(id: string, submitted: boolean): Promise<TaxReport>;
  };
  contracts: {
    list(): Promise<Contract[]>;
    templates(): Promise<ContractTemplate[]>;
  };
}

/** Ошибка, которую бросает любая реализация API. */
export class ApiError extends Error {
  constructor(
    public readonly body: ApiErrorBody,
    public readonly status = 400,
  ) {
    super(body.message);
    this.name = "ApiError";
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
