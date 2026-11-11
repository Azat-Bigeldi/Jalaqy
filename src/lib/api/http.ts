import { ApiError, type JalaqyApi } from "./client";
import type { ApiErrorBody } from "./contracts";
import type { EndpointKey, Endpoints } from "./endpoints";

/**
 * HTTP-клиент к бэкенду (FastAPI). Включается переменной JALAQY_API_URL.
 * Пути и методы — контракт для бэкенда; тела и ответы — типы из ./contracts.
 * Авторизация: cookie сессии пробрасывается сервером Next (см. lib/session).
 */
export function createHttpApi(
  baseUrl: string,
  getToken?: () => Promise<string | undefined>,
): JalaqyApi {
  /** key — строка контракта (см. ./endpoints), path — путь с подставленными параметрами. */
  async function call<K extends EndpointKey>(
    key: K,
    path: string,
    body?: Endpoints[K]["body"],
  ): Promise<Endpoints[K]["response"]> {
    const method = key.slice(0, key.indexOf(" "));
    const token = await getToken?.();
    const res = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(err ?? { code: "server", message: res.statusText }, res.status);
    }
    return (res.status === 204 ? undefined : await res.json()) as Endpoints[K]["response"];
  }
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1]));
    return s.size ? `?${s}` : "";
  };

  return {
    auth: {
      login: (input) => call("POST /auth/login", "/auth/login", input),
      register: (input) => call("POST /auth/register", "/auth/register", input),
    },
    account: {
      get: (id) => call("GET /account/{id}", `/account/${id}`),
      update: (id, patch) => call("PATCH /account/{id}", `/account/${id}`, patch),
      changePassword: (id, current, next) =>
        call("PUT /account/{id}/password", `/account/${id}/password`, { current, next }),
    },
    company: {
      get: () => call("GET /company", "/company"),
      update: (patch) => call("PATCH /company", "/company", patch),
      onboard: (input) => call("POST /company/onboarding", "/company/onboarding", input),
      users: () => call("GET /company/users", "/company/users"),
      inviteUser: (input) => call("POST /company/users", "/company/users", input),
      setUserRole: (id, role) =>
        call("PATCH /company/users/{id}", `/company/users/${id}`, { role }),
      setUserPassword: (id, password) =>
        call("PUT /company/users/{id}/password", `/company/users/${id}/password`, { password }),
      removeUser: (id) => call("DELETE /company/users/{id}", `/company/users/${id}`),
    },
    employees: {
      list: (opts = {}) =>
        call(
          "GET /employees",
          `/employees${q({ withDismissed: opts.withDismissed ? "1" : undefined })}`,
        ),
      get: (id) => call("GET /employees/{id}", `/employees/${id}`),
      create: (input) => call("POST /employees", "/employees", input),
      update: (id, patch) => call("PATCH /employees/{id}", `/employees/${id}`, patch),
      payslips: (id) => call("GET /employees/{id}/payslips", `/employees/${id}/payslips`),
      payslip: (id, period) =>
        call(
          "GET /employees/{id}/payslips/{period}",
          `/employees/${id}/payslips/${period ?? "latest"}`,
        ),
      certificates: (id) =>
        call("GET /employees/{id}/certificates", `/employees/${id}/certificates`),
      requestCertificate: (id, input) =>
        call("POST /employees/{id}/certificates", `/employees/${id}/certificates`, input),
      dismiss: (id, date) =>
        call("POST /employees/{id}/dismiss", `/employees/${id}/dismiss`, { date }),
      restore: (id) => call("POST /employees/{id}/restore", `/employees/${id}/restore`),
      remove: (id) => call("DELETE /employees/{id}", `/employees/${id}`),
      certificateRequests: () => call("GET /certificates/requests", "/certificates/requests"),
      markCertificateReady: (id) =>
        call("POST /certificates/{id}/ready", `/certificates/${id}/ready`),
    },
    payroll: {
      get: (period) => call("GET /payroll/{period}", `/payroll/${period}`),
      submit: (period) => call("POST /payroll/{period}/submit", `/payroll/${period}/submit`),
      approve: (period) => call("POST /payroll/{period}/approve", `/payroll/${period}/approve`),
      markPaid: (period) => call("POST /payroll/{period}/paid", `/payroll/${period}/paid`),
      reopen: (period) => call("POST /payroll/{period}/reopen", `/payroll/${period}/reopen`),
      export1c: (period) => call("GET /payroll/{period}/export/1c", `/payroll/${period}/export/1c`),
    },
    timesheet: {
      get: (period) => call("GET /timesheet/{period}", `/timesheet/${period}`),
      absences: (f = {}) =>
        call("GET /absences", `/absences${q({ employeeId: f.employeeId, status: f.status })}`),
      createAbsence: (input) => call("POST /absences", "/absences", input),
      decideAbsence: (id, decision) =>
        call("POST /absences/{id}/decision", `/absences/${id}/decision`, { decision }),
      requestLeave: (input) => call("POST /absences/requests", "/absences/requests", input),
      deleteAbsence: (id) => call("DELETE /absences/{id}", `/absences/${id}`),
    },
    taxes: {
      payments: (period) => call("GET /taxes/{period}/payments", `/taxes/${period}/payments`),
      markPaid: (id) =>
        call("POST /taxes/payments/{id}/paid", `/taxes/payments/${encodeURIComponent(id)}/paid`),
      paymentOrder: (id) =>
        call("GET /taxes/payments/{id}/order", `/taxes/payments/${encodeURIComponent(id)}/order`),
      reports: () => call("GET /taxes/reports", "/taxes/reports"),
      setReportSubmitted: (id, submitted) =>
        call("PUT /taxes/reports/{id}", `/taxes/reports/${id}`, { submitted }),
    },
    contracts: {
      list: () => call("GET /contracts", "/contracts"),
      templates: () => call("GET /contracts/templates", "/contracts/templates"),
    },
  };
}
