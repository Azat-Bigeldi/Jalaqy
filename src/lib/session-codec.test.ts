import { describe, expect, it } from "vitest";
import { canAccess, decodeSession, encodeSession, homeFor, safeNext } from "./session-codec";

describe("session codec", () => {
  const s = { userId: "u-acc", role: "accountant" as const, name: "Гульмира", companyId: "tulpan" };

  it("кодирует и раскодирует (в т. ч. кириллицу)", () => {
    expect(decodeSession(encodeSession(s))).toEqual(s);
  });

  it("мусор и неизвестные роли — null", () => {
    expect(decodeSession("не-base64")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession(encodeSession({ ...s, role: "admin" as never }))).toBeNull();
  });

  it("без верной подписи — null", () => {
    const [payload, signature] = encodeSession(s).split(".");
    const forged = Buffer.from(JSON.stringify({ ...s, role: "owner" })).toString("base64url");
    expect(decodeSession(payload)).toBeNull();
    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
    expect(decodeSession(`${payload}.${signature}x`)).toBeNull();
  });

  it("доступ по ролям", () => {
    expect(canAccess("accountant", "/app/payroll")).toBe(true);
    expect(canAccess("employee", "/app/payroll")).toBe(false);
    expect(canAccess("owner", "/owner")).toBe(true);
    expect(canAccess("accountant", "/me")).toBe(false);
    expect(homeFor("employee")).toBe("/me");
  });

  it("safeNext не пускает на чужие домены", () => {
    expect(safeNext("/app/taxes")).toBe("/app/taxes");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
  });
});
