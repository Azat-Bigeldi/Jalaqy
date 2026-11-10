"use client";

import { submitWith } from "@/lib/form-submit";
import { useActionState, useState, useTransition } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Input,
  Select,
  Sheet,
  StatusPill,
  Table,
  useToast,
  type TableColumn,
} from "@/components/ui";
import { IconPlus } from "@/components/ui/icons";
import { interpolate, t } from "@/i18n";
import type { CompanyUser, Role, StaffRole } from "@/lib/api/contracts";
import { formatKzPhone, normalizeKzPhone } from "@/lib/validation/contact";
import {
  inviteUserAction,
  setUserPasswordAction,
  setUserRoleAction,
  type FormState,
} from "./actions";

const u = t.settings.users;
const staffRoles = (["accountant", "owner"] as const).map((r) => ({
  value: r,
  label: t.domain.roles[r],
}));
const allRoles = (["accountant", "owner", "employee"] as const).map((r) => ({
  value: r,
  label: t.domain.roles[r],
}));

export interface EmployeeOption {
  id: string;
  name: string;
}

function RoleSelect({ user }: { user: CompanyUser }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  if (user.role === "employee") return <span>{t.domain.roles.employee}</span>;
  return (
    <Select
      label={interpolate(u.roleLabel, { name: user.name })}
      hideLabel
      options={staffRoles}
      defaultValue={user.role}
      disabled={pending}
      className="h-11 min-w-40"
      onChange={(e) => {
        const role = e.target.value as StaffRole;
        startTransition(async () => {
          const r = await setUserRoleAction(user.id, role);
          toast.show(r.ok ? { title: u.roleChanged } : { title: r.error, tone: "error" });
        });
      }}
    />
  );
}

/** Логин для показа: телефон — в виде +7 7XX…, почта — как есть. */
function shownContact(contact: string): string {
  const phone = normalizeKzPhone(contact);
  return phone && !contact.includes("@") ? formatKzPhone(phone) : contact;
}

function PasswordSheet({ user, onClose }: { user: CompanyUser | null; onClose: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await setUserPasswordAction(prev, form);
    if (r?.ok) {
      onClose();
      toast.show({ title: u.passwordChanged });
    }
    return r;
  }, null);
  const errors = state && !state.ok ? (state.fields ?? {}) : {};
  const common = state && !state.ok && !state.fields ? state.error : undefined;
  return (
    <Sheet
      open={user !== null}
      onClose={onClose}
      title={u.passwordTitle}
      description={user ? interpolate(u.passwordDescription, { name: user.name }) : undefined}
    >
      {user && (
        <form
          key={user.id}
          action={action}
          onSubmit={submitWith(action)}
          noValidate
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="userId" value={user.id} />
          {/* для менеджеров паролей: чей это пароль */}
          <input type="hidden" name="username" autoComplete="username" value={user.contact} />
          <Input
            name="password"
            type="text"
            label={u.newPassword}
            hint={u.passwordHint}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            required
            error={errors.password ?? common}
          />
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={onClose}>
              {t.ui.cancel}
            </Button>
            <Button type="submit" loading={pending}>
              {u.savePassword}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

export function UsersSection({
  users,
  employees,
}: {
  users: CompanyUser[];
  employees: EmployeeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [role, setRole] = useState<Role>("accountant");
  const [passwordFor, setPasswordFor] = useState<CompanyUser | null>(null);
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await inviteUserAction(prev, form);
    if (r?.ok) {
      setOpen(false);
      setFormKey((k) => k + 1);
      setRole("accountant");
      toast.show({ title: u.invited });
    }
    return r;
  }, null);
  const errors = state && !state.ok ? (state.fields ?? {}) : {};
  const common = state && !state.ok && !state.fields ? state.error : undefined;

  const withLogin = new Set(users.map((x) => x.employeeId).filter(Boolean));
  const freeEmployees = employees.filter((e) => !withLogin.has(e.id));

  const columns: TableColumn<CompanyUser>[] = [
    {
      key: "name",
      header: u.name,
      render: (x) => <span className="font-semibold">{x.name}</span>,
    },
    { key: "contact", header: u.contact, render: (x) => shownContact(x.contact) },
    { key: "role", header: u.role, render: (x) => <RoleSelect user={x} /> },
    {
      key: "status",
      header: u.status,
      render: (x) =>
        x.status === "active" ? (
          <StatusPill status="approved">{t.domain.userStatus.active}</StatusPill>
        ) : (
          <Badge tone="warning">{t.domain.userStatus.invited}</Badge>
        ),
    },
    {
      key: "actions",
      header: u.actions,
      render: (x) => (
        <Button
          variant="ghost"
          size="md"
          aria-label={interpolate(u.changePasswordFor, { name: x.name })}
          onClick={() => setPasswordFor(x)}
        >
          {u.changePassword}
        </Button>
      ),
    },
  ];

  return (
    <Card as="section" aria-labelledby="set-users" padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-xl flex-col gap-1">
          <h2 id="set-users" className="font-display text-xl font-bold tracking-display">
            {u.title}
          </h2>
          <p className="text-body text-muted">{u.description}</p>
        </div>
        <Button variant="secondary" icon={<IconPlus size={18} />} onClick={() => setOpen(true)}>
          {u.invite}
        </Button>
      </div>
      <Table
        caption={u.caption}
        columns={columns}
        rows={users}
        rowKey={(x) => x.id}
        minWidth={820}
        className="px-0"
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={u.inviteTitle}
        description={u.inviteDescription}
      >
        <form
          key={formKey}
          action={action}
          onSubmit={submitWith(action)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Select
            name="role"
            label={u.role}
            options={allRoles}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          />
          {role === "employee" ? (
            freeEmployees.length > 0 ? (
              <Select
                name="employeeId"
                label={u.employee}
                placeholder={u.employeePlaceholder}
                options={freeEmployees.map((e) => ({ value: e.id, label: e.name }))}
                defaultValue=""
                required
                error={errors.employeeId}
              />
            ) : (
              <Banner tone="info">{u.noEmployees}</Banner>
            )
          ) : (
            <Input name="name" label={u.name} required error={errors.name} />
          )}
          <Input
            name="contact"
            label={u.contactField}
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            error={errors.contact}
          />
          <Input
            name="password"
            type="text"
            label={u.password}
            hint={u.passwordHint}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            error={errors.password}
          />
          {common && <Banner tone="danger">{common}</Banner>}
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t.ui.cancel}
            </Button>
            <Button type="submit" loading={pending}>
              {u.send}
            </Button>
          </div>
        </form>
      </Sheet>
      <PasswordSheet user={passwordFor} onClose={() => setPasswordFor(null)} />
    </Card>
  );
}
