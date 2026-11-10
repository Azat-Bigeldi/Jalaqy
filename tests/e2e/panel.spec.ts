import { expect, test } from "@playwright/test";
import { withCheckDigit } from "../../src/lib/api/mock/seed";
import { loginAs, resetData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

test.describe("вход", () => {
  test("без сессии — на вход с возвратом; неверный пароль; вход", async ({ page }) => {
    await page.goto("/app/taxes");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftaxes/);
    await page.getByLabel("Телефон или эл. почта").fill("123");
    await page.getByLabel("Пароль").fill("secret-123");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Телефон +7 7XX XXX XX XX или эл. почта")).toBeVisible();

    await page.getByLabel("Телефон или эл. почта").fill("+7 701 123 45 14");
    await page.getByLabel("Пароль").fill("wrong");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный логин или пароль")).toBeVisible();
    // логин остаётся в поле после ошибки
    await expect(page.getByLabel("Телефон или эл. почта")).toHaveValue("+7 701 123 45 14");

    await page.getByLabel("Пароль").fill("secret-123");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/app\/taxes$/);
    await expect(page.getByRole("heading", { level: 1, name: "Налоги и отчёты" })).toBeVisible();
  });

  test("выход", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!);
    await page.goto("/app/payroll");
    const isMobile = (page.viewportSize()?.width ?? 0) < 1024;
    if (isMobile)
      await page.locator("header").getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("button", { name: "Выйти" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("панель бухгалтера", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await loginAs(context, baseURL!);
  });

  test("зарплата за октябрь: цифры из дизайна и отправка на подтверждение", async ({ page }) => {
    await page.goto("/app/payroll");
    await expect(
      page.getByRole("heading", { level: 1, name: "Зарплата за октябрь 2026" }),
    ).toBeVisible();
    await expect(page.getByText("6 сотрудников · период 1–31 октября")).toBeVisible();
    const table = page.getByRole("table", { name: /Расчёт зарплаты по сотрудникам/ });
    await expect(table.getByRole("rowheader")).toHaveCount(7); // 6 + «Итого»
    await expect(table.locator("tfoot")).toContainText(/1\s558\s890/);
    await expect(page.getByRole("main")).toContainText(/615\s546\s₸/);
    await expect(page.getByRole("main")).toContainText(/2\s174\s436\s₸/);
    await expect(page.getByRole("listitem").filter({ hasText: "Расчёт" }).first()).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.getByRole("button", { name: "Отправить на подтверждение" }).click();
    const dialog = page.getByRole("dialog", { name: "Отправить расчёт на подтверждение?" });
    await expect(dialog).toContainText("1 558 890");
    await dialog.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Расчёт отправлен владельцу" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Ждёт подтверждения" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Выплата" })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  test("выгрузка в 1С отдаёт CSV", async ({ page }) => {
    const res = await page.request.get("/api/export/1c?period=2026-10");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("448575");
  });

  test("сотрудники: поиск, добавление с ошибкой и без", async ({ page }) => {
    await page.goto("/app/employees");
    await page.getByRole("searchbox", { name: /Поиск/ }).fill("бариста");
    await expect(page.getByRole("table").getByRole("link")).toHaveCount(3);
    await page.getByRole("searchbox", { name: /Поиск/ }).fill("");

    await page.getByRole("button", { name: "Добавить сотрудника" }).click();
    const sheet = page.getByRole("dialog", { name: "Новый сотрудник" });
    await sheet.getByLabel("Имя").fill("Алия");
    await sheet.getByLabel("Фамилия").fill("Нурланова");
    await sheet.getByLabel("Должность").fill("Повар");
    await sheet.getByLabel("Оклад, ₸").fill("50000");
    await sheet.getByLabel("ИИН").fill("123");
    await sheet.getByRole("button", { name: "Добавить" }).click();
    await expect(sheet.getByText(/ниже МЗП/)).toBeVisible();
    await expect(sheet.getByLabel("ИИН")).toHaveAttribute("aria-invalid", "true");

    await sheet.getByLabel("Оклад, ₸").fill("280000");
    await sheet.getByLabel("ИИН").fill(withCheckDigit("99010150012"));
    await sheet.getByLabel("Дата приёма").fill("2026-10-15");
    await sheet.getByRole("button", { name: "Добавить" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сотрудник добавлен" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Алия Нурланова" })).toBeVisible();

    await page.goto("/app/payroll");
    await expect(page.getByText("7 сотрудников · период 1–31 октября")).toBeVisible();
    await expect(page.getByText("Повар · новый · 11 из 21 дн.")).toBeVisible();
  });

  test("карточка: без заявления на вычет ИПН растёт", async ({ page }) => {
    await page.goto("/app/employees/daniyar");
    await expect(page.getByRole("heading", { level: 1, name: "Данияр Касымов" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Расчёт за октябрь 2026" })).toContainText(
      /−15\s185\s₸/,
    );
    const sw = page.getByRole("switch", { name: "Заявление на вычет 30 МРП" });
    await page.getByText("Заявление на вычет 30 МРП").click(); // как человек: по подписи
    await expect(sw).not.toBeChecked();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Изменения сохранены" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Расчёт за октябрь 2026" })).toContainText(
      /−28\s160\s₸/,
    );
  });

  test("табель: одобрить заявку на отпуск", async ({ page }) => {
    await page.goto("/app/timesheet?month=2026-11");
    await expect(page.getByRole("table", { name: "Календарь за ноябрь 2026" })).toBeVisible();
    await page.getByRole("button", { name: "Одобрить: Асель Б." }).click();
    await expect(page.getByRole("status").filter({ hasText: "Отпуск одобрен" })).toBeVisible();
    await expect(page.getByText("Новых заявок нет.")).toBeVisible();
  });

  test("налоги: суммы и отметка об оплате", async ({ page }) => {
    await page.goto("/app/taxes");
    await expect(page.getByRole("main")).toContainText(/615\s546\s₸/);
    await page.getByRole("button", { name: "Отметить оплаченным: ИПН" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Платёж отмечен оплаченным" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Отметить оплаченным: ИПН" })).toHaveCount(0);
    const order = await page.request.get("/api/payments/2026-10%3Aipn");
    expect(await order.text()).toContain("ИПН");
  });

  test("договоры: понятное пустое состояние", async ({ page }) => {
    await page.goto("/app/contracts");
    await expect(page.getByRole("heading", { name: "Договоров пока нет" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Трудовой договор" })).toBeVisible();
  });

  test("настройки: пользователь с паролем, вход сотруднику, смена пароля и роли", async ({
    page,
  }) => {
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Добавить пользователя" });
    await sheet.getByLabel("Имя").fill("Сауле");
    await sheet.getByLabel("Телефон или эл. почта для входа").fill("нет");
    await sheet.getByRole("textbox", { name: /^Пароль/ }).fill("123");
    await sheet.getByRole("button", { name: "Добавить" }).click();
    await expect(sheet.getByText(/или эл. почта$/).last()).toBeVisible();
    await expect(sheet.getByText("Пароль — не короче 8 символов")).toBeVisible();
    await sheet.getByLabel("Телефон или эл. почта для входа").fill("saule@tulpan.kz");
    await sheet.getByRole("textbox", { name: /^Пароль/ }).fill("saule-2026");
    await sheet.getByRole("button", { name: "Добавить" }).click();
    await expect(page.getByRole("cell", { name: "saule@tulpan.kz" })).toBeVisible();

    // вход сотруднику: выбираем из списка, имя — из карточки
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await sheet.getByRole("combobox", { name: /^Роль/ }).selectOption("employee");
    await sheet.getByLabel("Сотрудник").selectOption({ label: "Бекова Асель" });
    await sheet.getByLabel("Телефон или эл. почта для входа").fill("asel@tulpan.kz");
    await sheet.getByRole("textbox", { name: /^Пароль/ }).fill("asel-2026!");
    await sheet.getByRole("button", { name: "Добавить" }).click();
    await expect(page.getByRole("cell", { name: "Асель Бекова" })).toBeVisible();

    await page.getByRole("button", { name: "Сменить пароль: Асель Бекова" }).click();
    const pwd = page.getByRole("dialog", { name: "Новый пароль" });
    await pwd.getByLabel("Новый пароль").fill("new-pass-1");
    await pwd.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Пароль изменён" })).toBeVisible();

    await page.getByRole("combobox", { name: "Роль: Алия Омарова" }).selectOption("owner");
    await expect(page.getByRole("status").filter({ hasText: "Роль изменена" })).toBeVisible();
  });

  test("мобильное меню ведёт по разделам", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "только для узкого экрана");
    await page.goto("/app/payroll");
    await page.locator("header").getByRole("button", { name: "Открыть меню" }).click();
    await page
      .getByRole("dialog", { name: "Основное меню" })
      .getByRole("link", { name: "Сотрудники" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Сотрудники" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Основное меню" })).toBeHidden();
  });

  test("первый Tab — ссылка «Перейти к содержимому»", async ({ page }) => {
    await page.goto("/app/payroll");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Перейти к содержимому" })).toBeFocused();
  });
});

test("онбординг: БИН с ошибкой, импорт CSV, завершение", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("БИН").fill("123456789012");
  await page.getByLabel("Название").fill("ТОО «Береке»");
  await page.getByLabel("Налоговый режим").selectOption("general");
  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.getByText(/верной контрольной цифрой/)).toBeVisible();

  await page.getByLabel("БИН").fill(withCheckDigit("12345678901"));
  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.getByRole("heading", { name: "Добавьте сотрудников" })).toBeFocused();

  const iin = withCheckDigit("98071230045");
  await page.locator("input[type=file]").setInputFiles({
    name: "staff.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `ФИО;Должность;Оклад;Дата приёма;ИИН;Вычет\nСапаров Нурлан;Повар;310000;01.10.2026;${iin};да\nОшибка;;1;;;\n`,
    ),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Загружено: 1 сотрудник" }),
  ).toContainText("пропущены: 3");
  await expect(page.getByText("Сапаров Нурлан")).toBeVisible();

  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "Завершить настройку" }).click();
  await expect(page).toHaveURL(/\/app\/payroll$/);
  await expect(page.getByText("7 сотрудников · период 1–31 октября")).toBeVisible();
});
