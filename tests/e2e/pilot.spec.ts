import { expect, test } from "@playwright/test";
import { loginAs, resetData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

test.describe("пилот: владелец ведёт расчёт сам", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await loginAs(context, baseURL!, "owner");
  });

  test("подтверждает, возвращает на доработку, снова подтверждает и отмечает выплату", async ({
    page,
  }) => {
    await page.goto("/app/payroll");
    await page.getByRole("button", { name: "Подтвердить выплату" }).click();
    await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
    await expect(page.getByRole("button", { name: "Отметить выплаченной" })).toBeVisible();

    await page.getByRole("button", { name: "Вернуть в расчёт" }).click();
    await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
    await expect(page.getByRole("button", { name: "Подтвердить выплату" })).toBeVisible();

    await page.getByRole("button", { name: "Подтвердить выплату" }).click();
    await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
    await page.getByRole("button", { name: "Отметить выплаченной" }).click();
    await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
    await expect(page.getByRole("main")).toContainText("Зарплата выплачена");
    await expect(page.getByRole("button", { name: "Отметить выплаченной" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Вернуть в расчёт" })).toHaveCount(0);
  });

  test("переключает месяцы расчёта", async ({ page }) => {
    await page.goto("/app/payroll");
    await page.getByRole("link", { name: /Предыдущий месяц: Сентябрь 2026/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Зарплата за сентябрь 2026" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Следующий месяц: Октябрь 2026/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Зарплата за октябрь 2026" }),
    ).toBeVisible();
  });

  test("увольняет сотрудника с датой и отменяет увольнение", async ({ page }) => {
    await page.goto("/app/employees/timur");
    await page.getByRole("button", { name: "Уволить" }).click();
    await page.getByLabel("Последний рабочий день").fill("2026-10-15");
    await page.getByRole("dialog").getByRole("button", { name: "Уволить" }).click();
    await expect(page.getByRole("main")).toContainText("Уволен 15 октября 2026");

    await page.goto("/app/employees");
    await expect(page.getByRole("main")).toContainText("уволен 15.10.2026");

    await page.goto("/app/employees/timur");
    await page.getByRole("button", { name: "Отменить увольнение" }).click();
    await expect(page.getByRole("button", { name: "Уволить" })).toBeVisible();
  });

  test("профиль: логин, роль, выход", async ({ page }) => {
    await page.goto("/app/profile");
    await expect(page.getByRole("heading", { level: 1, name: "Профиль" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toContainText("Ержан Сейткали");
    await expect(main).toContainText("+7 701 111 22 33");
    await expect(main).toContainText("Владелец");
    await expect(page.getByRole("heading", { name: "Сменить пароль" })).toBeVisible();
    await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("закрывает доступ другому пользователю, свой удалить не может", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.getByRole("button", { name: "Удалить доступ: Ержан Сейткали" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Удалить доступ: Алия Омарова" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByRole("table", { name: "Пользователи компании" })).not.toContainText(
      "Алия Омарова",
    );
  });
});
