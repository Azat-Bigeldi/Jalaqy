/*
 * Один код — два сайта (два проекта на Vercel):
 *
 *   JALAQY_SITE=landing — только лендинг. Вход и кабинеты уводят на JALAQY_APP_URL.
 *   JALAQY_SITE=app     — только приложение: вход, онбординг, панель бухгалтера,
 *                         экраны владельца и сотрудника. Главная ведёт на вход
 *                         (или на «свой» экран, если уже вошли).
 *   не задано           — всё вместе (локальная разработка и e2e).
 *
 * Юридические страницы (/privacy, /offer) открываются на обоих сайтах:
 * на них ссылаются и лендинг, и форма входа.
 */

export type Site = "landing" | "app" | "all";

export function currentSite(value = process.env.JALAQY_SITE): Site {
  return value === "landing" || value === "app" ? value : "all";
}

/** Разделы приложения: на лендинге их нет. */
const APP_PREFIXES = [
  "/app",
  "/owner",
  "/me",
  "/login",
  "/register",
  "/logout",
  "/onboarding",
  "/launch",
  "/offline",
];

/** Разделы только лендинга: в приложении их нет. */
const LANDING_ONLY = ["/api/waitlist", "/styleguide"];

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isAppPath = (pathname: string) => APP_PREFIXES.some((p) => under(pathname, p));

export type SiteDecision =
  | { kind: "pass" }
  /** Внешний адрес (другой сайт) или путь на этом сайте */
  | { kind: "redirect"; to: string }
  | { kind: "notFound" };

/**
 * Что делать с запросом на этом сайте. otherUrl — адрес второго сайта
 * (JALAQY_APP_URL для лендинга, JALAQY_LANDING_URL для приложения).
 */
export function routeForSite(
  site: Site,
  pathname: string,
  search: string,
  otherUrl: string | undefined,
): SiteDecision {
  if (site === "landing" && isAppPath(pathname)) {
    if (!otherUrl) return { kind: "notFound" };
    return { kind: "redirect", to: new URL(pathname + search, otherUrl).toString() };
  }
  if (site === "app") {
    // главная приложения — вход или «свой» экран (как у установленного PWA)
    if (pathname === "/") return { kind: "redirect", to: "/launch" };
    if (LANDING_ONLY.some((p) => under(pathname, p))) {
      return otherUrl
        ? { kind: "redirect", to: new URL(pathname + search, otherUrl).toString() }
        : { kind: "notFound" };
    }
  }
  return { kind: "pass" };
}
