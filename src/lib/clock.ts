import type { ISODate, Period } from "@/lib/api/contracts";
import { MOCK_TODAY } from "@/lib/api/mock/seed";
import { dataMode } from "@/lib/mode";

/** Демо (JALAQY_DEMO=1): время заморожено, чтобы демо всегда показывало октябрь. */
function isFrozen(): boolean {
  return dataMode() === "demo";
}

const ALMATY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Almaty",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * «Сегодня» для расчётов — по времени Казахстана. В демо заморожено (MOCK_TODAY).
 * Переопределяется JALAQY_TODAY=ГГГГ-ММ-ДД.
 */
export function today(): ISODate {
  if (process.env.JALAQY_TODAY) return process.env.JALAQY_TODAY;
  if (isFrozen()) return MOCK_TODAY;
  return ALMATY.format(new Date());
}

/** Момент «сейчас» для отметок времени (ISO, UTC). */
export function nowIso(): string {
  if (process.env.JALAQY_TODAY || isFrozen()) return `${today()}T12:00:00Z`;
  return new Date().toISOString();
}

export function currentPeriod(): Period {
  return today().slice(0, 7);
}

/** Сколько дней от сегодня до даты (может быть отрицательным). */
export function daysUntil(date: ISODate): number {
  return Math.round((Date.parse(date) - Date.parse(today())) / 86_400_000);
}
