import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginAs, resetData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

async function ownerApproves(page: Page, context: BrowserContext, baseURL: string) {
  await loginAs(context, baseURL, "owner");
  await page.goto("/owner");
  await page.getByRole("button", { name: "Подтвердить выплату" }).click();
  await expect(page).toHaveURL(/\/owner\/approved\?period=2026-10/);
}

test.describe("владелец", () => {
  test("вход демо-владельцем ведёт на его экран", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Телефон или эл. почта").fill("+7 701 111 22 33");
    await page.getByLabel("Пароль").fill("demo-pass");
    await page.getByRole("radio", { name: "Владелец" }).check();
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/owner$/);
  });

  test("владелец выходит из аккаунта", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "owner");
    await page.goto("/owner");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/login\?next=%2Fowner/);
  });

  test("итог, изменения, отпуск и подтверждение выплаты", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "owner");
    await page.goto("/owner");
    await expect(
      page.getByRole("heading", { level: 1, name: "Зарплата за октябрь готова" }),
    ).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toContainText(/1\s558\s890\s₸/);
    await expect(main).toContainText("к выплате 6 сотрудникам");
    await expect(main).toContainText(/615\s546\s₸/);
    await expect(main).toContainText(/2\s174\s436\s₸/);
    await expect(page.getByRole("heading", { name: "Что изменилось с сентября" })).toBeVisible();
    await expect(main).toContainText("Новый сотрудник: Тимур А., курьер");
    await expect(main).toContainText(/Данияр К\. повышен: оклад 320\s000\s₸/);
    await expect(main).toContainText("Асель Б. просит отпуск");
    await expect(main).toContainText("10–14 ноября · 5 дней");

    await page.getByRole("button", { name: "Одобрить: Асель Б." }).click();
    await expect(page.getByRole("status").filter({ hasText: "Отпуск одобрен" })).toBeVisible();
    await expect(main).not.toContainText("Асель Б. просит отпуск");

    await page.getByRole("button", { name: "Подтвердить выплату" }).click();
    await expect(page).toHaveURL(/\/owner\/approved/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Выплата подтверждена" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toContainText(/1\s558\s890\s₸ получат 6 сотрудников/);
    await page.getByRole("link", { name: "На главную" }).click();
    await expect(page.getByRole("main")).toContainText("Выплата за октябрь подтверждена");
    await expect(page.getByRole("button", { name: "Подтвердить выплату" })).toHaveCount(0);
  });

  test("расчёт по каждому", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "owner");
    await page.goto("/owner/breakdown");
    await expect(page.getByRole("listitem").filter({ hasText: "Мадина Ж." })).toContainText(
      /448\s575\s₸/,
    );
    await expect(page.locator("main li").filter({ hasText: "Курьер" })).toHaveCount(1);
  });
});

test.describe("сотрудник", () => {
  test("до подтверждения — сентябрь, после — октябрь как в дизайне", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAs(context, baseURL!, "employee");
    await page.goto("/me");
    await expect(page.getByRole("heading", { level: 1, name: "Сентябрь 2026" })).toBeVisible();

    await context.clearCookies();
    await ownerApproves(page, context, baseURL!);
    await context.clearCookies();
    await loginAs(context, baseURL!, "employee");

    await page.goto("/me");
    await expect(page.getByRole("heading", { level: 1, name: "Октябрь 2026" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toContainText("Данияр К. · Старший бариста");
    await expect(main).toContainText(/266\s415\s₸/);
    await expect(main).toContainText("Выплата 5 ноя");
    await expect(main).toContainText(/−32\s000\s₸/);
    await expect(main).toContainText(/−15\s185\s₸/);
    await expect(main).toContainText(/52\s096\s₸/);
    await expect(main).toContainText("доступно 14 дней");
    await expect(
      page.getByRole("navigation", { name: "Разделы" }).getByRole("link", { name: "Зарплата" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("заявка на отпуск: ошибка лимита и отправка", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "employee");
    await page.goto("/me");
    await page
      .getByRole("link", { name: /Отпуск/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Отпуск" })).toBeVisible();
    await page.getByLabel(/^С\*?$/).fill("2026-11-02");
    await page.getByLabel(/^По\*?$/).fill("2026-11-30");
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText("Доступно только 14 дн. отпуска")).toBeVisible();

    await page.getByLabel(/^По\*?$/).fill("2026-11-06");
    await expect(page.getByText("Получится 5 дней")).toBeVisible();
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Заявка отправлена владельцу" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Мои заявки" })).toContainText("2–6 ноября");
  });

  test("справка, история и профиль", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "employee");
    await page.goto("/me/certificate");
    await page.getByRole("radio", { name: "О доходах за 6 месяцев" }).check();
    await page.getByLabel("Для чего").fill("Для визы");
    await page.getByRole("button", { name: "Заказать справку" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Справку заказали" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Мои справки" })).toContainText("Для визы");
    const ready = await page.request.get("/api/certificates/cert-1");
    expect(await ready.text()).toContain("Касымов Данияр");

    await page.goto("/me/history");
    await expect(page.getByRole("link", { name: "Открыть листок за Январь 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Открыть листок за Июнь 2026" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Июнь 2026" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Разделы" })
      .getByRole("link", { name: "Профиль" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Данияр Касымов" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Заявление подано");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("сотрудник не попадает в панель бухгалтера", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "employee");
    await page.goto("/app/payroll");
    await expect(page).toHaveURL(/\/me$/);
  });
});

test.describe("PWA", () => {
  test("manifest, иконки, service worker, launch", async ({ page, context, baseURL }) => {
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({
      name: "Jalaqy",
      display: "standalone",
      start_url: "/launch",
      lang: "ru",
    });
    for (const icon of manifest.icons as Array<{ src: string }>) {
      expect((await page.request.get(icon.src)).status()).toBe(200);
    }
    expect((await page.request.get("/apple-icon.png")).status()).toBe(200);
    expect(await (await page.request.get("/sw.js")).text()).toContain("/offline");

    await page.goto("/launch");
    await expect(page).toHaveURL(/\/login$/);
    await loginAs(context, baseURL!, "employee");
    await page.goto("/launch");
    await expect(page).toHaveURL(/\/me$/);
  });

  test("без сети показывается офлайн-экран", async ({ page, context, baseURL }) => {
    await loginAs(context, baseURL!, "employee");
    await page.goto("/me");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // страница под контролем service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto("/me/history").catch(() => {});
    await expect(page.getByRole("heading", { level: 1, name: "Нет соединения" })).toBeVisible();
    await context.setOffline(false);
  });
});
