"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner, Button, Card, Input } from "@/components/ui";
import { t } from "@/i18n";
import { submitWith } from "@/lib/form-submit";
import { registerAction, type RegisterState } from "../actions";

const r = t.manage.register;

export function RegisterForm({ needCode }: { needCode: boolean }) {
  const [state, register, pending] = useActionState<RegisterState, FormData>(registerAction, null);
  const errors = state?.fields ?? {};
  const common = state && !state.fields ? state.error : undefined;

  return (
    <Card padding="lg" radius="sheet" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title font-extrabold tracking-display">{r.title}</h1>
        <p className="text-body text-muted">{r.subtitle}</p>
      </div>
      <form
        action={register}
        onSubmit={submitWith(register)}
        className="flex flex-col gap-4"
        noValidate
      >
        <Input
          name="companyName"
          label={r.companyName}
          placeholder={r.companyPlaceholder}
          autoComplete="organization"
          required
          defaultValue={state?.values.companyName}
          error={errors.companyName}
        />
        <Input
          name="name"
          label={r.name}
          autoComplete="name"
          required
          defaultValue={state?.values.name}
          error={errors.name}
        />
        <Input
          name="contact"
          label={r.contact}
          hint={r.contactHint}
          placeholder={t.auth.login.contactPlaceholder}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.values.contact}
          error={errors.contact}
        />
        <Input
          name="password"
          type="password"
          label={r.password}
          hint={r.passwordHint}
          autoComplete="new-password"
          required
          error={errors.password}
        />
        {needCode && (
          <Input
            name="code"
            label={r.code}
            hint={r.codeHint}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            error={errors.code}
          />
        )}
        {common && <Banner tone="danger">{common}</Banner>}
        <Button type="submit" size="xl" fullWidth loading={pending}>
          {r.submit}
        </Button>
      </form>
      <Link href="/login" className="text-center text-body font-semibold">
        {r.haveAccount}
      </Link>
    </Card>
  );
}
