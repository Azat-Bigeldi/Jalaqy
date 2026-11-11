/**
 * Русский словарь — единственный источник строк интерфейса.
 * Разбит по разделам в ./ru/*. Казахский (kk.ts) переопределяет ключи частично;
 * недостающие берутся отсюда.
 */
import { app } from "./ru/app";
import { auth } from "./ru/auth";
import { core } from "./ru/core";
import { documents } from "./ru/documents";
import { domain } from "./ru/domain";
import { employees } from "./ru/employees";
import { landing } from "./ru/landing";
import { manage } from "./ru/manage";
import { mobile } from "./ru/mobile";
import { settings } from "./ru/settings";
import { styleguide } from "./ru/styleguide";
import { taxes } from "./ru/taxes";
import { timesheet } from "./ru/timesheet";

export const ru = {
  ...core,
  domain,
  app,
  auth,
  employees,
  timesheet,
  taxes,
  settings,
  manage,
  mobile,
  landing,
  documents,
  styleguide,
} as const;
