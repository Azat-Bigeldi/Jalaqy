"use client";

import { submitWith } from "@/lib/form-submit";
import { useActionState } from "react";
import { Button, Card, DatePicker, Input, MoneyInput, Switch, useToast } from "@/components/ui";
import { t } from "@/i18n";
import type { Employee } from "@/lib/api/contracts";
import { formatKzPhone, normalizeKzPhone } from "@/lib/validation/contact";
import { updateEmployeeAction, type EmployeeFormState } from "../actions";

const c = t.employees.card;
const m = t.manage.employees;

export function EditEmployeeForm({
  employee,
  readOnly,
}: {
  employee: Employee;
  readOnly: boolean;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState<EmployeeFormState, FormData>(
    async (prev, form) => {
      const result = await updateEmployeeAction(prev, form);
      if (result?.ok) toast.show({ title: c.saved });
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? (state.fields ?? {}) : {};

  return (
    <Card as="section" aria-labelledby="emp-details" padding="lg" className="flex flex-col gap-4">
      <h2 id="emp-details" className="font-display text-xl font-bold tracking-display">
        {c.details}
      </h2>
      <form
        action={action}
        onSubmit={submitWith(action)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={employee.id} />
        <Input
          name="firstName"
          label={m.firstName}
          defaultValue={employee.firstName}
          autoComplete="off"
          required
          disabled={readOnly}
          error={errors.firstName}
        />
        <Input
          name="lastName"
          label={m.lastName}
          defaultValue={employee.lastName}
          autoComplete="off"
          required
          disabled={readOnly}
          error={errors.lastName}
        />
        <Input
          name="position"
          label={c.position}
          defaultValue={employee.position}
          required
          disabled={readOnly}
          error={errors.position}
        />
        <MoneyInput
          name="salary"
          label={c.salary}
          defaultValue={employee.salary}
          hint={c.salaryFromHint}
          required
          disabled={readOnly}
          error={errors.salary}
        />
        <Input
          name="phone"
          type="tel"
          label={c.phone}
          defaultValue={
            normalizeKzPhone(employee.phone)
              ? formatKzPhone(normalizeKzPhone(employee.phone)!)
              : employee.phone
          }
          disabled={readOnly}
          error={errors.phone}
        />
        <DatePicker
          name="hireDate"
          label={m.hireDate}
          defaultValue={employee.hireDate}
          required
          disabled={readOnly}
          error={errors.hireDate}
        />
        <Input
          name="iin"
          label={m.iin}
          defaultValue={employee.iin}
          inputMode="numeric"
          maxLength={12}
          autoComplete="off"
          required
          disabled={readOnly}
          error={errors.iin}
        />
        <Input
          name="vacationDaysLeft"
          label={m.vacationDays}
          defaultValue={String(employee.vacationDaysLeft)}
          inputMode="numeric"
          maxLength={3}
          autoComplete="off"
          required
          disabled={readOnly}
          error={errors.vacationDaysLeft}
        />
        <div className="sm:col-span-2">
          <Switch
            name="hasDeduction"
            label={c.deduction}
            description={c.deductionHint}
            defaultChecked={employee.hasDeduction}
            disabled={readOnly}
          />
        </div>
        {state && !state.ok && !state.fields && (
          <p role="alert" className="text-body text-danger sm:col-span-2">
            {state.error}
          </p>
        )}
        {!readOnly && (
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending}>
              {c.save}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
