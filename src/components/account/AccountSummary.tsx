import { Avatar, Card } from "@/components/ui";
import { t } from "@/i18n";
import type { CompanyUser } from "@/lib/api/contracts";
import { formatKzPhone, normalizeKzPhone } from "@/lib/validation/contact";
import { NameForm } from "./AccountForms";

const p = t.manage.profile;

/** Логин для показа: телефон — в виде +7 7XX…, почта — как есть. */
export function shownContact(contact: string): string {
  const phone = normalizeKzPhone(contact);
  return phone && !contact.includes("@") ? formatKzPhone(phone) : contact;
}

/** Карточка «Аккаунт»: кто вошёл, логин, роль, компания, имя. */
export function AccountSummary({ user, companyName }: { user: CompanyUser; companyName: string }) {
  const rows: Array<[string, string]> = [
    ...(user.contact ? ([[p.login, shownContact(user.contact)]] as Array<[string, string]>) : []),
    [p.role, t.domain.roles[user.role]],
    [p.company, companyName],
  ];
  return (
    <Card as="section" aria-labelledby="acc-summary" padding="lg" className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size={48} />
        <div className="flex min-w-0 flex-col">
          <h2 id="acc-summary" className="truncate font-display text-xl font-bold tracking-display">
            {user.name}
          </h2>
          <span className="text-body text-muted">{t.domain.roles[user.role]}</span>
        </div>
      </div>
      <dl className="m-0 flex flex-col">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-divider py-2.5 text-body"
          >
            <dt className="text-muted">{label}</dt>
            <dd className="m-0 font-semibold break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <NameForm name={user.name} editable={user.role !== "employee"} />
    </Card>
  );
}
