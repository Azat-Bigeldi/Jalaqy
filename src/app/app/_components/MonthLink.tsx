import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { t } from "@/i18n";
import { formatDate } from "@/lib/format";
import { shiftPeriod } from "@/lib/period";

/**
 * Стрелка «предыдущий / следующий месяц» для разделов с выбором периода.
 * path — раздел, param — имя параметра (?period=2026-10).
 */
export function MonthLink({
  period,
  dir,
  disabled,
  path = "/app/payroll",
  param = "period",
}: {
  period: string;
  dir: -1 | 1;
  disabled?: boolean;
  path?: string;
  param?: string;
}) {
  const target = shiftPeriod(period, dir);
  const label = `${dir < 0 ? t.manage.payroll.prev : t.manage.payroll.next}: ${formatDate(`${target}-01`, "monthYear")}`;
  const icon = dir < 0 ? <IconChevronLeft /> : <IconChevronRight />;
  const box = "inline-flex size-11 items-center justify-center rounded-button bg-surface";
  if (disabled) {
    return (
      <span aria-hidden="true" className={`${box} text-muted opacity-40`}>
        {icon}
      </span>
    );
  }
  return (
    <Link
      href={`${path}?${param}=${target}`}
      aria-label={label}
      title={label}
      className={`${box} text-ink no-underline is-hover:bg-success-bg`}
    >
      {icon}
    </Link>
  );
}
