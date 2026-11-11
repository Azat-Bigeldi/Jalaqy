"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Avatar, Badge, EmptyState, Input, Table, type TableColumn } from "@/components/ui";
import { IconSearch } from "@/components/ui/icons";
import { interpolate, t } from "@/i18n";
import type { Employee } from "@/lib/api/contracts";
import { formatDate, formatNumber } from "@/lib/format";

const e = t.employees;

const columns: TableColumn<Employee>[] = [
  {
    key: "name",
    header: e.table.employee,
    render: (emp) => (
      <span className="flex items-center gap-3">
        <Avatar name={`${emp.firstName} ${emp.lastName}`} size={40} />
        <span className="flex min-w-0 flex-col">
          <Link
            href={`/app/employees/${emp.id}`}
            className="font-semibold text-ink no-underline is-hover:underline"
          >
            {emp.firstName} {emp.lastName}
          </Link>
          <span className="text-caption text-muted">
            {emp.position}
            {emp.status === "dismissed" && emp.dismissDate && (
              <>
                {" · "}
                {interpolate(t.manage.employees.dismissedMeta, {
                  date: formatDate(emp.dismissDate, "numeric"),
                })}
              </>
            )}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "salary",
    header: e.table.salary,
    align: "right",
    render: (emp) => formatNumber(emp.salary),
  },
  {
    key: "hired",
    header: e.table.hired,
    align: "right",
    render: (emp) => formatDate(emp.hireDate, "numeric"),
  },
  {
    key: "deduction",
    header: e.table.deduction,
    render: (emp) =>
      emp.status === "dismissed" ? (
        <Badge tone="danger">{t.manage.employees.dismissedBadge}</Badge>
      ) : emp.hasDeduction ? (
        <Badge tone="success">{e.table.yes}</Badge>
      ) : (
        <Badge tone="neutral">{e.table.no}</Badge>
      ),
  },
  {
    key: "vacation",
    header: e.table.vacation,
    align: "right",
    render: (emp) => interpolate(e.table.vacationDays, { days: emp.vacationDaysLeft }),
  },
];

/** Список сотрудников с поиском по имени и должности (фильтр на клиенте). */
export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const q = deferred.trim().toLocaleLowerCase("ru");
  const rows = q
    ? employees.filter((emp) =>
        `${emp.firstName} ${emp.lastName} ${emp.position}`.toLocaleLowerCase("ru").includes(q),
      )
    : employees;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        label={e.search}
        hideLabel
        placeholder={e.search}
        startAdornment={<IconSearch size={18} />}
        value={query}
        onChange={(ev) => setQuery(ev.target.value)}
        fieldClassName="max-w-md"
      />
      <Table
        caption={e.table.caption}
        columns={columns}
        rows={rows}
        rowKey={(emp) => emp.id}
        minWidth={720}
        empty={
          <EmptyState
            icon={<IconSearch size={26} />}
            title={interpolate(e.nothingFound, { query: deferred })}
            className="py-8"
          />
        }
      />
    </div>
  );
}
