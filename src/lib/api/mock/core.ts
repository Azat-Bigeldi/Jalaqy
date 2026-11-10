import { t } from "@/i18n";
import { ApiError } from "../client";
import type { Employee } from "../contracts";
import { getDb } from "./db";
import { nowIso } from "@/lib/clock";

export const v = t.domain.validation;

/** Задержка ответа мока, мс (переменная окружения JALAQY_MOCK_LATENCY_MS). */
export function latency(): Promise<void> {
  const ms = Number(process.env.JALAQY_MOCK_LATENCY_MS ?? 0);
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

/** Возвращаем копии: вызывающий не должен менять «базу» напрямую. */
export const clone = <T>(value: T): T => structuredClone(value);

export const now = () => nowIso();

export function validation(fields: Record<string, string | undefined>): never {
  throw new ApiError(
    { code: "validation", message: t.ui.formErrors, fields: fields as Record<string, string> },
    422,
  );
}

export function notFound(): never {
  throw new ApiError({ code: "not_found", message: v.notFound }, 404);
}

export function findEmployee(id: string): Employee {
  return getDb().employees.find((e) => e.id === id) ?? notFound();
}
