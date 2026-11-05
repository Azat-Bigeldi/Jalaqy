import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role, Session } from "@/lib/api/contracts";

export const SESSION_COOKIE = "jalaqy_session";

const ROLES: Role[] = ["accountant", "owner", "employee"];

/** Ключ подписи. В production обязателен; в dev и тестах — запасной. */
function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set");
  }
  return "jalaqy-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Сессия: JSON в base64url + HMAC-подпись через точку. Без верной подписи
 * cookie не принимается — роль и компанию нельзя подменить руками.
 */
export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): Session | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Session>;
    if (!s.userId || !s.companyId || !s.name || !s.role || !ROLES.includes(s.role)) return null;
    return s as Session;
  } catch {
    return null;
  }
}

/** Куда вести после входа. */
export function homeFor(role: Role): string {
  if (role === "owner") return "/owner";
  if (role === "employee") return "/me";
  return "/app/payroll";
}

/** Кому какие разделы доступны. */
export function canAccess(role: Role, pathname: string): boolean {
  if (pathname.startsWith("/app")) {
    return role === "accountant" || role === "owner";
  }
  if (pathname.startsWith("/owner")) return role === "owner";
  if (pathname.startsWith("/me")) return role === "employee";
  return true;
}

/** Безопасный внутренний путь для ?next= (никаких //evil.com). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return null;
  return next;
}
