import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordOk, verifyPassword } from "./password";

describe("password", () => {
  it("принимает верный пароль и отклоняет неверный", async () => {
    const stored = await hashPassword("секрет-123");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("секрет-123", stored)).toBe(true);
    expect(await verifyPassword("секрет-124", stored)).toBe(false);
  });

  it("соль разная — хэши одного пароля не совпадают", async () => {
    expect(await hashPassword("abcdefgh")).not.toBe(await hashPassword("abcdefgh"));
  });

  it("пустой или битый хэш — не пускаем", async () => {
    expect(await verifyPassword("abcdefgh", undefined)).toBe(false);
    expect(await verifyPassword("abcdefgh", "md5$xx")).toBe(false);
  });

  it("минимальная длина 8", () => {
    expect(isPasswordOk("1234567")).toBe(false);
    expect(isPasswordOk("12345678")).toBe(true);
  });
});
