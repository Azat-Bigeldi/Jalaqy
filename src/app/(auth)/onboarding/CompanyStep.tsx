"use client";

import { Input, Select } from "@/components/ui";
import { t } from "@/i18n";
import type { OnboardingInput } from "@/lib/api/contracts";

const c = t.auth.onboarding.company;
const regimes = t.domain.regimes;

export type CompanyDraft = OnboardingInput["company"];

export function CompanyStep({
  value,
  errors,
  firstPeriods,
  onChange,
}: {
  firstPeriods: Array<{ value: string; label: string }>;
  value: CompanyDraft;
  errors: Partial<Record<keyof CompanyDraft, string>>;
  onChange: (patch: Partial<CompanyDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        label={c.bin}
        hint={c.binHint}
        inputMode="numeric"
        maxLength={12}
        required
        value={value.bin}
        onChange={(e) => onChange({ bin: e.target.value.replace(/\D/g, "") })}
        error={errors.bin}
      />
      <Input
        label={c.name}
        placeholder={c.namePlaceholder}
        autoComplete="organization"
        required
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        error={errors.name}
      />
      <Select
        label={c.regime}
        placeholder={c.regimePlaceholder}
        required
        value={value.regime}
        onChange={(e) => onChange({ regime: e.target.value as CompanyDraft["regime"] })}
        options={(Object.keys(regimes) as Array<keyof typeof regimes>).map((k) => ({
          value: k,
          label: regimes[k],
        }))}
        error={errors.regime}
      />
      <Select
        label={t.manage.onboarding.firstPeriod}
        hint={t.manage.onboarding.firstPeriodHint}
        value={value.firstPeriod ?? ""}
        onChange={(e) => onChange({ firstPeriod: e.target.value })}
        options={firstPeriods}
        error={errors.firstPeriod}
      />
    </div>
  );
}
