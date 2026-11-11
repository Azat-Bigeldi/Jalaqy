"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { t } from "@/i18n";
import { submitWith } from "@/lib/form-submit";
import { changePasswordAction, updateNameAction, type AccountFormState } from "./actions";

const p = t.manage.profile;

/** Имя в профиле. У сотрудника имя берётся из карточки — поле только для чтения. */
export function NameForm({ name, editable }: { name: string; editable: boolean }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    async (prev, form) => {
      const r = await updateNameAction(prev, form);
      if (r?.ok) toast.show({ title: p.nameSaved });
      return r;
    },
    null,
  );
  const errors = state && !state.ok ? (state.fields ?? {}) : {};
  const common = state && !state.ok && !state.fields ? state.error : undefined;
  return (
    <form action={action} onSubmit={submitWith(action)} noValidate className="flex flex-col gap-3">
      <Input
        name="name"
        label={p.name}
        defaultValue={name}
        autoComplete="name"
        required
        disabled={!editable}
        error={errors.name ?? common}
      />
      {editable && (
        <div>
          <Button type="submit" variant="secondary" loading={pending}>
            {p.saveName}
          </Button>
        </div>
      )}
    </form>
  );
}

/** Смена своего пароля: нужен текущий. */
export function PasswordForm({ contact, className }: { contact: string; className?: string }) {
  const toast = useToast();
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    async (prev, form) => {
      const r = await changePasswordAction(prev, form);
      if (r?.ok) {
        setFormKey((k) => k + 1); // очищаем поля
        toast.show({ title: p.passwordSaved });
      }
      return r;
    },
    null,
  );
  const errors = state && !state.ok ? (state.fields ?? {}) : {};
  const common = state && !state.ok && !state.fields ? state.error : undefined;
  return (
    <Card
      as="section"
      aria-labelledby="acc-password"
      padding="lg"
      className={`flex flex-col gap-4 ${className ?? ""}`}
    >
      <h2 id="acc-password" className="font-display text-xl font-bold tracking-display">
        {p.passwordTitle}
      </h2>
      <form
        key={formKey}
        action={action}
        onSubmit={submitWith(action)}
        noValidate
        className="flex flex-col gap-4"
      >
        {/* для менеджеров паролей: чей это пароль */}
        <input type="hidden" name="username" autoComplete="username" value={contact} readOnly />
        <Input
          name="current"
          type="password"
          label={p.current}
          autoComplete="current-password"
          required
          error={errors.current}
        />
        <Input
          name="next"
          type="password"
          label={p.next}
          hint={p.nextHint}
          autoComplete="new-password"
          required
          error={errors.next ?? common}
        />
        <div>
          <Button type="submit" loading={pending}>
            {p.savePassword}
          </Button>
        </div>
      </form>
    </Card>
  );
}
