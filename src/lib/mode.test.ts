import { describe, expect, it } from "vitest";
import { dataMode } from "./mode";

const keys = {
  FIREBASE_PROJECT_ID: "p",
  FIREBASE_CLIENT_EMAIL: "e",
  FIREBASE_PRIVATE_KEY: "k",
};

describe("режим данных", () => {
  it("без настроек — не демо, а «не подключено»", () => {
    expect(dataMode({})).toBe("none");
  });
  it("неполные ключи Firebase — тоже «не подключено»", () => {
    expect(dataMode({ FIREBASE_PROJECT_ID: "p" })).toBe("none");
  });
  it("демо — только по явному флагу", () => {
    expect(dataMode({ JALAQY_DEMO: "1" })).toBe("demo");
    expect(dataMode({ JALAQY_DEMO: "true" })).toBe("none");
  });
  it("ключи Firebase важнее флага демо", () => {
    expect(dataMode({ ...keys, JALAQY_DEMO: "1" })).toBe("firebase");
  });
  it("свой бэкенд важнее всего", () => {
    expect(dataMode({ ...keys, JALAQY_API_URL: "https://api" })).toBe("http");
  });
});
