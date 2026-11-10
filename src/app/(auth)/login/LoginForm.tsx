"use client";

import { submitWith } from "@/lib/form-submit";
import Link from "next/link";
import { useActionState } from "react";
import { Banner, Button, Card, Input, RadioGroup } from "@/components/ui";
import { t } from "@/i18n";
import { loginAction, type LoginState } from "../actions";

const l = t.auth.login;

export function LoginForm({ next, demo }: { next?: string; demo: boolean }) {
  const [state, login, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const fieldErrors = state?.fields ?? {};
  const common = state && !state.fields ? state.error : undefined;

  return (
    <Card padding="lg" radius="sheet" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title font-extrabold tracking-display">{l.title}</h1>
        <p className="text-body text-muted">{l.subtitle}</p>
      </div>
      <form action={login} onSubmit={submitWith(login)} className="flex flex-col gap-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          name="contact"
          label={l.contact}
          placeholder={l.contactPlaceholder}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          // после ошибки контакт остаётся в поле; key пересоздаёт поле с новым значением
          key={state?.contact}
          defaultValue={state?.contact}
          error={fieldErrors.contact}
        />
        <Input
          name="password"
          type="password"
          label={l.password}
          autoComplete="current-password"
          required
          error={fieldErrors.password ?? common}
        />
        {demo && (
          <>
            <Banner tone="info">{l.demoHint}</Banner>
            <RadioGroup
              legend={l.demoRole}
              name="role"
              defaultValue="accountant"
              orientation="horizontal"
              options={(["accountant", "owner", "employee"] as const).map((r) => ({
                value: r,
                label: t.domain.roles[r],
              }))}
            />
          </>
        )}
        <Button type="submit" size="xl" fullWidth loading={pending}>
          {l.signIn}
        </Button>
      </form>
      {demo ? (
        <Link href="/onboarding" className="text-center text-body font-semibold">
          {l.newCompany}
        </Link>
      ) : (
        <p className="text-center text-caption text-muted">{l.forgot}</p>
      )}
    </Card>
  );
}
