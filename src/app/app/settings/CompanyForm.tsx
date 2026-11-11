"use client";

import { submitWith } from "@/lib/form-submit";
import { useActionState } from "react";
import { Button, Card, Input, Select, useToast } from "@/components/ui";
import { t } from "@/i18n";
import type { Company } from "@/lib/api/contracts";
import { updateCompanyAction, type FormState } from "./actions";

const s = t.settings.company;
const regimes = t.domain.regimes;

export function CompanyForm({
  company,
  firstPeriods,
}: {
  company: Company;
  firstPeriods: Array<{ value: string; label: string }>;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await updateCompanyAction(prev, form);
    if (r?.ok) toast.show({ title: s.saved });
    return r;
  }, null);
  const errors = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <Card as="section" aria-labelledby="set-company" padding="lg" className="flex flex-col gap-4">
      <h2 id="set-company" className="font-display text-xl font-bold tracking-display">
        {s.title}
      </h2>
      <form
        action={action}
        onSubmit={submitWith(action)}
        noValidate
        className="grid gap-4 md:grid-cols-2"
      >
        <Input
          name="name"
          label={s.name}
          defaultValue={company.name}
          required
          error={errors.name}
        />
        <Input
          name="bin"
          label={s.bin}
          defaultValue={company.bin}
          inputMode="numeric"
          maxLength={12}
          required
          error={errors.bin}
        />
        <Select
          name="regime"
          label={s.regime}
          defaultValue={company.regime}
          options={(Object.keys(regimes) as Array<keyof typeof regimes>).map((k) => ({
            value: k,
            label: regimes[k],
          }))}
        />
        <Input
          name="address"
          label={s.address}
          defaultValue={company.address}
          autoComplete="street-address"
        />
        <Select
          name="firstPeriod"
          label={t.manage.users.firstPeriod}
          hint={t.manage.onboarding.firstPeriodHint}
          defaultValue={company.firstPeriod}
          options={firstPeriods}
          error={errors.firstPeriod}
          fieldClassName="md:col-span-2"
        />
        <div className="md:col-span-2">
          <Button type="submit" loading={pending}>
            {s.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}
