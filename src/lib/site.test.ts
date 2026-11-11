import { describe, expect, it } from "vitest";
import { currentSite, routeForSite } from "./site";

const APP = "https://app.jalaqy.kz";
const LANDING = "https://jalaqy.kz";

describe("разделение сайтов", () => {
  it("без JALAQY_SITE — всё вместе", () => {
    expect(currentSite(undefined)).toBe("all");
    expect(currentSite("что-то")).toBe("all");
    expect(routeForSite("all", "/login", "", undefined)).toEqual({ kind: "pass" });
    expect(routeForSite("all", "/", "", undefined)).toEqual({ kind: "pass" });
  });

  it("лендинг: вход и кабинеты уводят в приложение с тем же путём", () => {
    expect(routeForSite("landing", "/login", "?next=%2Fapp", APP)).toEqual({
      kind: "redirect",
      to: "https://app.jalaqy.kz/login?next=%2Fapp",
    });
    expect(routeForSite("landing", "/app/payroll", "", APP)).toMatchObject({ kind: "redirect" });
    expect(routeForSite("landing", "/me", "", APP)).toMatchObject({ kind: "redirect" });
    expect(routeForSite("landing", "/", "", APP)).toEqual({ kind: "pass" });
    expect(routeForSite("landing", "/privacy", "", APP)).toEqual({ kind: "pass" });
    // похожие, но чужие пути не трогаем
    expect(routeForSite("landing", "/application", "", APP)).toEqual({ kind: "pass" });
  });

  it("лендинг без адреса приложения — 404 вместо входа", () => {
    expect(routeForSite("landing", "/login", "", undefined)).toEqual({ kind: "notFound" });
  });

  it("приложение: главная — на вход, лист ожидания — на лендинг", () => {
    expect(routeForSite("app", "/", "", LANDING)).toEqual({ kind: "redirect", to: "/launch" });
    expect(routeForSite("app", "/api/waitlist", "", LANDING)).toEqual({
      kind: "redirect",
      to: "https://jalaqy.kz/api/waitlist",
    });
    expect(routeForSite("app", "/api/waitlist", "", undefined)).toEqual({ kind: "notFound" });
    expect(routeForSite("app", "/login", "", LANDING)).toEqual({ kind: "pass" });
    expect(routeForSite("app", "/offer", "", LANDING)).toEqual({ kind: "pass" });
  });
});
