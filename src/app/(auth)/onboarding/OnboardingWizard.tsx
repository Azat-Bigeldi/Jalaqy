"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, Stepper } from "@/components/ui";
import { interpolate, t } from "@/i18n";
import type { EmployeeInput } from "@/lib/api/contracts";
import { formatCount } from "@/lib/format";
import { hasErrors, validateCompany } from "@/lib/validation/forms";
import { finishOnboardingAction } from "./actions";
import { CompanyStep, type CompanyDraft } from "./CompanyStep";
import { EmployeesStep } from "./EmployeesStep";

const o = t.auth.onboarding;

export function OnboardingWizard({
  defaultHireDate,
  companyName = "",
  firstPeriods,
  defaultFirstPeriod,
}: {
  defaultHireDate: string;
  /** Название из регистрации — подставляем в форму */
  companyName?: string;
  firstPeriods: Array<{ value: string; label: string }>;
  defaultFirstPeriod: string;
}) {
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState<CompanyDraft>({
    bin: "",
    name: companyName,
    regime: "" as CompanyDraft["regime"],
    firstPeriod: defaultFirstPeriod,
  });
  const [companyErrors, setCompanyErrors] = useState<Partial<Record<keyof CompanyDraft, string>>>(
    {},
  );
  const [employees, setEmployees] = useState<EmployeeInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  function go(next: number) {
    setStep(next);
    // фокус на заголовок шага — скринридер объявит новый шаг
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function nextFromCompany() {
    const errors: Partial<Record<keyof CompanyDraft, string>> = {
      ...validateCompany({ name: company.name, bin: company.bin }),
    };
    if (!company.name.trim()) errors.name = t.domain.validation.required;
    if (!company.regime) errors.regime = t.domain.validation.required;
    setCompanyErrors(errors);
    if (!hasErrors(errors)) go(1);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await finishOnboardingAction({ company, employees });
      if (result && !result.ok) setError(result.error);
    });
  }

  const titles = [o.company.title, o.employees.title, o.done.title];
  const texts = [
    o.company.text,
    o.employees.text,
    interpolate(o.done.text, {
      name: company.name,
      count: formatCount(employees.length, t.plural.employees),
    }),
  ];

  return (
    <Card padding="lg" radius="sheet" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="text-sm font-semibold text-muted">{o.title}</h1>
        <Stepper
          steps={[...o.steps]}
          current={step}
          label={interpolate(o.stepOf, { n: step + 1, total: 3 })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-title font-extrabold tracking-display outline-none"
        >
          {titles[step]}
        </h2>
        <p className="text-body text-muted">{texts[step]}</p>
      </div>

      {step === 0 && (
        <CompanyStep
          value={company}
          errors={companyErrors}
          firstPeriods={firstPeriods}
          onChange={(patch) => setCompany((c) => ({ ...c, ...patch }))}
        />
      )}
      {step === 1 && (
        <EmployeesStep
          employees={employees}
          onChange={setEmployees}
          defaultHireDate={defaultHireDate}
        />
      )}

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2.5 border-t border-divider pt-4">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => go(step - 1)} disabled={pending}>
            {o.back}
          </Button>
        ) : (
          <span />
        )}
        {step === 0 && <Button onClick={nextFromCompany}>{o.next}</Button>}
        {step === 1 && <Button onClick={() => go(2)}>{o.next}</Button>}
        {step === 2 && (
          <Button onClick={finish} loading={pending}>
            {o.finish}
          </Button>
        )}
      </div>
    </Card>
  );
}
