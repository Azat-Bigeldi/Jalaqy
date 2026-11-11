import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { resetDb } from "./db";
import { mockApi as api } from "./index";
import { withCheckDigit } from "./seed";

beforeEach(() => resetDb());

describe("мок: зарплата за октябрь 2026", () => {
  it("совпадает с макетом до тенге (суммы считает lib/payroll)", async () => {
    const run = await api.payroll.get("2026-10");
    expect(run.lines.map((l) => l.shortName)).toEqual([
      "Мадина Ж.",
      "Данияр К.",
      "Асель Б.",
      "Ерлан Т.",
      "Айгерим С.",
      "Тимур А.",
    ]);
    expect(run.totals).toMatchObject({
      gross: 1_870_000,
      net: 1_558_890,
      withheld: 311_110,
      employer: 304_436,
      toBudget: 615_546,
      cost: 2_174_436,
    });
    expect(run.status).toBe("calculated");
    expect(run.taxDueDate).toBe("2026-11-25");
  });

  it("что изменилось с сентября: новый курьер и повышение Данияра", async () => {
    const run = await api.payroll.get("2026-10");
    // как в макете владельца: сначала новый сотрудник, потом повышение
    expect(run.changes).toEqual([
      { kind: "hired", employeeId: "timur", shortName: "Тимур А.", position: "Курьер" },
      { kind: "salary", employeeId: "daniyar", shortName: "Данияр К.", from: 280_000, to: 320_000 },
    ]);
  });

  it("неполный месяц: Айгерим принята 15 апреля", async () => {
    const run = await api.payroll.get("2026-04");
    const line = run.lines.find((l) => l.employeeId === "aigerim")!;
    expect(line.workedDays).toBeLessThan(line.normDays);
    expect(line.gross).toBeLessThan(250_000);
    expect(line.isNew).toBe(true);
  });

  it("статусы: отправка → подтверждение, повторная отправка — конфликт", async () => {
    await api.payroll.submit("2026-10");
    expect((await api.payroll.get("2026-10")).status).toBe("awaiting_approval");
    await expect(api.payroll.submit("2026-10")).rejects.toBeInstanceOf(ApiError);
    await api.payroll.approve("2026-10");
    expect((await api.payroll.get("2026-10")).status).toBe("approved");
  });

  it("выгрузка в 1С: CSV с BOM и строкой на сотрудника", async () => {
    const file = await api.payroll.export1c("2026-10");
    expect(file.content.startsWith("﻿")).toBe(true);
    expect(file.content.split("\r\n")).toHaveLength(7);
    expect(file.content).toContain("448575");
  });
});

describe("мок: сотрудники", () => {
  const valid = {
    firstName: "Алия",
    lastName: "Нурланова",
    position: "Повар",
    salary: 280_000,
    hireDate: "2026-10-15",
    iin: withCheckDigit("99010150012"),
    hasDeduction: true,
  };

  it("создание пересчитывает октябрь с неполным месяцем", async () => {
    await api.employees.create(valid);
    const run = await api.payroll.get("2026-10");
    expect(run.lines).toHaveLength(7);
    const line = run.lines.at(-1)!;
    expect(line.workedDays).toBe(11);
    expect(line.gross).toBe(146_667); // 280 000 × 11 / 21
  });

  it("ошибки валидации — по полям", async () => {
    const err = await api.employees
      .create({ ...valid, salary: 50_000, iin: "123", firstName: "" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(Object.keys((err as ApiError).body.fields ?? {}).sort()).toEqual([
      "firstName",
      "iin",
      "salary",
    ]);
  });

  it("смена оклада и вычета меняет расчёт", async () => {
    await api.employees.update("daniyar", { hasDeduction: false });
    const run = await api.payroll.get("2026-10");
    expect(run.lines.find((l) => l.employeeId === "daniyar")!.employee.ipn).toBe(28_160);
  });

  it("история выплат: с января по октябрь, свежие сверху", async () => {
    const slips = await api.employees.payslips("madina");
    expect(slips[0]?.period).toBe("2026-10");
    expect(slips.at(-1)?.period).toBe("2026-01");
    expect(slips[1]?.status).toBe("closed");
  });

  it("несуществующий — not_found", async () => {
    await expect(api.employees.get("nobody")).rejects.toMatchObject({ status: 404 });
  });
});

describe("мок: табель и налоги", () => {
  it("отпуск без содержания уменьшает начисление", async () => {
    await api.timesheet.createAbsence({
      employeeId: "erlan",
      type: "unpaid",
      from: "2026-10-05",
      to: "2026-10-09",
    });
    const line = (await api.payroll.get("2026-10")).lines.find((l) => l.employeeId === "erlan")!;
    expect(line.workedDays).toBe(16);
    expect(line.gross).toBe(190_476); // 250 000 × 16 / 21
  });

  it("одобрение отпуска списывает календарные дни", async () => {
    await api.timesheet.decideAbsence("abs-1", "approved");
    expect((await api.employees.get("asel")).vacationDaysLeft).toBe(7); // 12 − 5
  });

  it("заявка длиннее остатка отпуска не одобряется", async () => {
    const db = (await import("./db")).getDb();
    db.absences.push({
      id: "abs-long",
      employeeId: "timur",
      type: "vacation",
      from: "2026-11-02",
      to: "2026-11-06",
      status: "pending",
      requestedAt: "2026-10-29T10:00:00Z",
    });
    const err = await api.timesheet.decideAbsence("abs-long", "approved").catch((e: unknown) => e);
    expect((err as ApiError).body.fields?.decision).toMatch(/2 дн/);
  });

  it("налоги за октябрь = «в бюджет» из расчёта, срок 25 ноября", async () => {
    const payments = await api.taxes.payments("2026-10");
    expect(payments.reduce((s, p) => s + p.amount, 0)).toBe(615_546);
    expect(payments.every((p) => p.dueDate === "2026-11-25" && p.status === "unpaid")).toBe(true);
    await api.taxes.markPaid("2026-10:ipn");
    expect((await api.taxes.payments("2026-10")).find((p) => p.kind === "ipn")?.status).toBe(
      "paid",
    );
  });

  it("табель октября: норма 21, 26 октября — праздник", async () => {
    const sheet = await api.timesheet.get("2026-10");
    expect(sheet.normDays).toBe(21);
    expect(sheet.days.find((d) => d.date === "2026-10-26")).toMatchObject({
      working: false,
      holiday: true,
    });
  });
});

describe("мок: вход", () => {
  it("пароль «wrong» — ошибка, любой другой — вход под выбранной ролью", async () => {
    await expect(
      api.auth.login({ contact: "+77011234514", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);
    const s = await api.auth.login({ contact: "+77011234514", password: "x", demoRole: "owner" });
    expect(s.role).toBe("owner");
  });
});

describe("мок: пользователи", () => {
  it("добавление: контакт нормализуется, пароль и занятый логин проверяются", async () => {
    const user = await api.company.inviteUser({
      name: "Алия",
      contact: "Aliya@Mail.KZ",
      role: "owner",
      password: "12345678",
    });
    expect(user).toMatchObject({ contact: "aliya@mail.kz", status: "invited" });

    const short = await api.company
      .inviteUser({ name: "Б", contact: "b@mail.kz", role: "owner", password: "123" })
      .catch((e: unknown) => e);
    expect((short as ApiError).body.fields?.password).toBeTruthy();

    const taken = await api.company
      .inviteUser({ name: "В", contact: "aliya@mail.kz", role: "owner", password: "12345678" })
      .catch((e: unknown) => e);
    expect((taken as ApiError).body.fields?.contact).toBeTruthy();
  });

  it("вход сотруднику: имя из карточки, второй вход тому же сотруднику — ошибка", async () => {
    const user = await api.company.inviteUser({
      name: "",
      contact: "+7 701 555 44 33",
      role: "employee",
      employeeId: "asel",
      password: "12345678",
    });
    expect(user).toMatchObject({
      name: "Асель Бекова",
      employeeId: "asel",
      contact: "+77015554433",
    });
    const again = await api.company
      .inviteUser({
        name: "",
        contact: "asel@mail.kz",
        role: "employee",
        employeeId: "asel",
        password: "12345678",
      })
      .catch((e: unknown) => e);
    expect((again as ApiError).body.fields?.employeeId).toBeTruthy();
    await expect(api.company.setUserRole(user.id, "owner")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("мок: экраны сотрудника и владельца", () => {
  it("листок виден только после подтверждения: до — сентябрь, после — октябрь как в дизайне", async () => {
    const before = await api.employees.payslip("daniyar");
    expect(before.period).toBe("2026-09");
    expect(before.line.net).toBe(234_735);

    await api.payroll.approve("2026-10"); // владелец может подтвердить сразу из «расчёт готов»
    const after = await api.employees.payslip("daniyar");
    expect(after).toMatchObject({ period: "2026-10", status: "approved", payDate: "2026-11-05" });
    expect(after.line.net).toBe(266_415);
    expect(after.line.employer.total).toBe(52_096);
  });

  it("неподтверждённый месяц по прямому запросу — not_found", async () => {
    await expect(api.employees.payslip("daniyar", "2026-10")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("заявка на отпуск: ждёт решения; больше остатка — ошибка поля", async () => {
    const leave = await api.timesheet.requestLeave({
      employeeId: "daniyar",
      from: "2026-11-16",
      to: "2026-11-20",
    });
    expect(leave.status).toBe("pending");
    const err = await api.timesheet
      .requestLeave({ employeeId: "timur", from: "2026-11-02", to: "2026-11-06" })
      .catch((e: unknown) => e);
    expect((err as ApiError).body.fields?.to).toMatch(/2 дн/);
  });

  it("справки: заказ появляется сверху со статусом «готовится»", async () => {
    await api.employees.requestCertificate("daniyar", { kind: "income", purpose: "Для визы" });
    const list = await api.employees.certificates("daniyar");
    expect(list[0]).toMatchObject({ kind: "income", purpose: "Для визы", status: "requested" });
    expect(list).toHaveLength(2);
  });
});

describe("мок: пилот — выплата, увольнение, доступы", () => {
  it("подтверждён → выплачен → налоги оплачены → месяц закрыт", async () => {
    await api.payroll.approve("2026-10");
    await expect(api.payroll.submit("2026-10")).rejects.toBeInstanceOf(ApiError);
    const paid = await api.payroll.markPaid("2026-10");
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).toBeTruthy();
    // выплаченный расчёт вернуть на доработку нельзя
    await expect(api.payroll.reopen("2026-10")).rejects.toBeInstanceOf(ApiError);
    for (const p of await api.taxes.payments("2026-10")) await api.taxes.markPaid(p.id);
    expect((await api.payroll.get("2026-10")).status).toBe("closed");
  });

  it("налоги оплачены раньше выплаты — месяц закрывается после отметки о выплате", async () => {
    await api.payroll.approve("2026-10");
    for (const p of await api.taxes.payments("2026-10")) await api.taxes.markPaid(p.id);
    expect((await api.payroll.get("2026-10")).status).toBe("approved");
    expect((await api.payroll.markPaid("2026-10")).status).toBe("closed");
  });

  it("подтверждённый расчёт можно вернуть: статус снова «расчёт готов», листок скрыт", async () => {
    await api.payroll.approve("2026-10");
    expect((await api.employees.payslip("daniyar")).period).toBe("2026-10");
    const run = await api.payroll.reopen("2026-10");
    expect(run.status).toBe("calculated");
    expect(run.approvedAt).toBeUndefined();
    expect((await api.employees.payslip("daniyar")).period).toBe("2026-09");
  });

  it("уволенный считается до последнего дня и остаётся в прошлых месяцах", async () => {
    const before = await api.payroll.get("2026-10");
    await api.employees.dismiss("timur", "2026-10-15");
    const october = await api.payroll.get("2026-10");
    const line = october.lines.find((l) => l.employeeId === "timur")!;
    expect(line.workedDays).toBeLessThan(line.normDays);
    expect(line.gross).toBeLessThan(before.lines.find((l) => l.employeeId === "timur")!.gross);
    expect(october.changes).toContainEqual({
      kind: "dismissed",
      employeeId: "timur",
      shortName: "Тимур А.",
    });
    expect((await api.employees.list()).map((e) => e.id)).not.toContain("timur");
    expect((await api.employees.list({ withDismissed: true })).map((e) => e.id)).toContain("timur");
    await expect(api.employees.dismiss("madina", "2020-01-01")).rejects.toBeInstanceOf(ApiError);
    // отмена увольнения возвращает полный месяц
    await api.employees.restore("timur");
    expect((await api.payroll.get("2026-10")).totals.net).toBe(before.totals.net);
  });

  it("удалить карточку можно только без подтверждённых выплат", async () => {
    // у Мадины есть закрытые месяцы
    await expect(api.employees.remove("madina")).rejects.toBeInstanceOf(ApiError);
    const created = await api.employees.create({
      firstName: "Тест",
      lastName: "Ошибочный",
      position: "Стажёр",
      salary: 200_000,
      hireDate: "2026-10-20",
      hasDeduction: true,
      iin: withCheckDigit("99010150012"),
    });
    await api.employees.remove(created.id);
    await expect(api.employees.get(created.id)).rejects.toBeInstanceOf(ApiError);
  });

  it("правка карточки: имя, дата приёма, остаток отпуска", async () => {
    const e = await api.employees.update("timur", {
      firstName: "Темир",
      hireDate: "2026-10-12",
      vacationDaysLeft: 5,
    });
    expect(e.shortName).toBe("Темир А.");
    expect(e.vacationDaysLeft).toBe(5);
    const line = (await api.payroll.get("2026-10")).lines.find((l) => l.employeeId === "timur")!;
    expect(line.workedDays).toBeLessThan(line.normDays);
    expect(line.gross).toBeGreaterThan(0);
    await expect(api.employees.update("timur", { vacationDaysLeft: -1 })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("доступ: себя удалить нельзя, другого — можно", async () => {
    await expect(api.company.removeUser("u-acc", "u-acc")).rejects.toBeInstanceOf(ApiError);
    await api.company.removeUser("u-inv", "u-acc");
    expect((await api.company.users()).map((u) => u.id)).not.toContain("u-inv");
  });

  it("удаление одобренного отпуска возвращает списанные дни", async () => {
    const before = (await api.employees.get("asel")).vacationDaysLeft;
    await api.timesheet.decideAbsence("abs-1", "approved");
    expect((await api.employees.get("asel")).vacationDaysLeft).toBe(before - 5);
    await api.timesheet.deleteAbsence("abs-1");
    expect((await api.employees.get("asel")).vacationDaysLeft).toBe(before);
  });

  it("месяц начала расчёта: не позже текущего", async () => {
    await expect(api.company.update({ firstPeriod: "2026-12" })).rejects.toBeInstanceOf(ApiError);
    expect((await api.company.update({ firstPeriod: "2026-09" })).firstPeriod).toBe("2026-09");
  });

  it("справки: заказанная видна бухгалтеру и становится готовой", async () => {
    const cert = await api.employees.requestCertificate("asel", {
      kind: "employment",
      purpose: "Для банка",
    });
    expect((await api.employees.certificateRequests()).map((c) => c.id)).toEqual([cert.id]);
    await api.employees.markCertificateReady(cert.id);
    expect(await api.employees.certificateRequests()).toEqual([]);
  });

  it("форма 200.00: отметка «сдана» и её снятие", async () => {
    const ready = (await api.taxes.reports()).find((r) => r.status === "ready")!;
    expect((await api.taxes.setReportSubmitted(ready.id, true)).status).toBe("submitted");
    expect((await api.taxes.setReportSubmitted(ready.id, false)).status).toBe("ready");
  });
});
