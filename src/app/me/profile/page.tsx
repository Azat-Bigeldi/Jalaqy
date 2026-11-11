import type { Metadata } from "next";
import { Suspense } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { MobileContent } from "@/components/mobile/MobileShell";
import { Avatar, Button, Card, Skeleton } from "@/components/ui";
import { IconLogout } from "@/components/ui/icons";
import { t } from "@/i18n";
import { PasswordForm } from "@/components/account/AccountForms";
import { getAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/format";
import { formatKzPhone, normalizeKzPhone } from "@/lib/validation/contact";
import { maskIin } from "@/lib/validation/iin";
import { requireEmployee } from "../session";

const p = t.mobile.profile;

export const metadata: Metadata = { title: p.title };

async function Profile() {
  const session = await requireEmployee();
  const [employee, company, account] = await Promise.all([
    api.employees.get(session.employeeId),
    api.company.get(),
    getAccount(session),
  ]);
  const phone = normalizeKzPhone(employee.phone);
  const rows: Array<[string, string]> = [
    [p.company, company.name],
    [p.position, employee.position],
    [p.hired, formatDate(employee.hireDate)],
    [p.iin, maskIin(employee.iin)],
    ...(employee.phone
      ? ([[p.phone, phone ? formatKzPhone(phone) : employee.phone]] as Array<[string, string]>)
      : []),
    [p.deduction, employee.hasDeduction ? p.deductionYes : p.deductionNo],
    [p.vacation, formatCount(employee.vacationDaysLeft, t.plural.days)],
  ];
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={`${employee.firstName} ${employee.lastName}`} size={64} />
        <div className="flex flex-col">
          <h1 className="font-display text-title font-extrabold tracking-display">
            {employee.firstName} {employee.lastName}
          </h1>
          <span className="text-body text-muted">{employee.position}</span>
        </div>
      </div>
      <Card padding="none">
        <dl className="m-0 flex flex-col">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-0.5 border-t border-divider px-4 py-3 first:border-t-0"
            >
              <dt className="text-caption text-muted">{label}</dt>
              <dd className="m-0 text-body">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {account.contact && <PasswordForm contact={account.contact} />}
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="secondary"
          size="xl"
          fullWidth
          icon={<IconLogout size={18} />}
        >
          {p.logout}
        </Button>
      </form>
    </>
  );
}

export default function ProfilePage() {
  return (
    <MobileContent>
      <Suspense fallback={<Skeleton className="h-96 rounded-card-lg" />}>
        <Profile />
      </Suspense>
    </MobileContent>
  );
}
