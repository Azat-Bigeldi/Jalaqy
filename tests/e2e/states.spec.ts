import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Role } from "../../src/lib/api/contracts";
import { loginAs, resetData } from "./helpers";

async function fail(page: Page, methods: string[]) {
  const res = await page.request.post("/api/test/fail", { data: { methods } });
  expect(res.status()).toBe(204);
}

async function axe(page: Page) {
  // замеряем после анимаций появления: полупрозрачный кадр даёт ложный «низкий контраст»
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

const cases: Array<{ path: string; role: Role; method: string }> = [
  { path: "/app/payroll", role: "accountant", method: "payroll.get" },
  { path: "/app/employees", role: "accountant", method: "employees.list" },
  { path: "/app/taxes", role: "accountant", method: "taxes.payments" },
  { path: "/owner", role: "owner", method: "payroll.get" },
  { path: "/me", role: "employee", method: "employees.get" },
];

test.describe("ошибка загрузки: понятный экран и повтор", () => {
  for (const c of cases) {
    test(c.path, async ({ page, context, baseURL }) => {
      await loginAs(context, baseURL!, c.role);
      await fail(page, [c.method]);
      await page.goto(c.path);
      await expect(
        page.getByRole("heading", { name: "Не удалось загрузить данные" }),
      ).toBeVisible();
      await fail(page, []);
      await page.getByRole("button", { name: "Попробовать ещё раз" }).click();
      await expect(page.getByRole("heading", { name: "Не удалось загрузить данные" })).toBeHidden();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});

test("404 — своя страница со ссылкой на главную", async ({ page }) => {
  const res = await page.goto("/net-takoy-stranicy");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Такой страницы нет" })).toBeVisible();
  await expect(page.getByRole("link", { name: "На главную" })).toBeVisible();
});

test("месяц без ставок в адресе — откат на текущий период, без падения", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAs(context, baseURL!, "accountant");
  await page.goto("/app/taxes?period=2031-03");
  await expect(page.getByRole("heading", { level: 1, name: "Налоги и отчёты" })).toBeVisible();
  await expect(page.getByText("за октябрь 2026", { exact: true })).toBeVisible();
});

test.describe("доступность открытых окон и шагов", () => {
  test("шторка «Новый сотрудник» с ошибками", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "accountant");
    await page.goto("/app/employees");
    await page.getByRole("button", { name: "Добавить сотрудника" }).click();
    const sheet = page.getByRole("dialog", { name: "Новый сотрудник" });
    await sheet.getByRole("button", { name: "Добавить" }).click();
    await expect(sheet.getByText("Заполните поле").first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("ошибка входа", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Телефон или эл. почта").fill("buh@tulpan.kz");
    await page.getByLabel("Пароль").fill("wrong");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный логин или пароль")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("мобильное меню панели", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "accountant");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/payroll");
    await page.locator("header").getByRole("button", { name: "Открыть меню" }).click();
    await expect(page.getByRole("dialog", { name: "Основное меню" })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("всё делается с клавиатуры: отправка расчёта", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "accountant");
    await page.goto("/app/payroll");
    const submit = page.getByRole("button", { name: "Отправить на подтверждение" });
    await expect(submit).toBeVisible();
    for (
      let i = 0;
      i < 30 && !(await submit.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(submit).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // в окне порядок фокуса: «Закрыть» → «Отмена» → «Отправить»
    await expect(dialog.getByRole("button", { name: "Закрыть" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Отправить", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Ждёт подтверждения" })).toBeVisible();
  });
});
