"use client";

import { useActionState, useState } from "react";
import { Button, Card, DatePicker, Sheet, useToast } from "@/components/ui";
import { interpolate, t } from "@/i18n";
import type { ActionResult } from "@/lib/actions";
import { submitWith } from "@/lib/form-submit";
import { ConfirmAction } from "../../_components/ConfirmAction";
import { ConfirmlessButton } from "../../_components/ConfirmlessButton";
import { dismissEmployeeAction, removeEmployeeAction, restoreEmployeeAction } from "../actions";

const m = t.manage.employees;

/** Увольнение (с датой), отмена увольнения и удаление карточки, добавленной по ошибке. */
export function ManageEmployee({
  id,
  name,
  dismissed,
  defaultDate,
  minDate,
}: {
  id: string;
  name: string;
  dismissed: boolean;
  defaultDate: string;
  minDate: string;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, form) => {
      const r = await dismissEmployeeAction(prev, form);
      if (r?.ok) {
        setOpen(false);
        toast.show({ title: m.dismissed });
      }
      return r;
    },
    null,
  );
  const errors = state && !state.ok ? (state.fields ?? {}) : {};
  const common = state && !state.ok && !state.fields ? state.error : undefined;

  return (
    <Card as="section" aria-labelledby="emp-manage" padding="lg" className="flex flex-col gap-3">
      <h2 id="emp-manage" className="font-display text-xl font-bold tracking-display">
        {m.manage}
      </h2>
      <p className="text-body text-muted">{m.dismissText}</p>
      <div className="flex flex-wrap gap-2.5">
        {dismissed ? (
          <ConfirmlessButton
            variant="secondary"
            action={restoreEmployeeAction.bind(null, id)}
            done={m.restored}
          >
            {m.restore}
          </ConfirmlessButton>
        ) : (
          <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
            {m.dismiss}
          </Button>
        )}
        <ConfirmAction
          variant="ghost"
          size="md"
          danger
          title={m.removeTitle}
          text={interpolate(m.removeText, { name })}
          confirmLabel={m.remove}
          action={removeEmployeeAction.bind(null, id)}
        >
          {m.remove}
        </ConfirmAction>
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={m.dismissTitle}
        description={interpolate(m.dismissDescription, { name })}
      >
        <form
          action={action}
          onSubmit={submitWith(action)}
          noValidate
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={id} />
          <DatePicker
            name="date"
            label={m.dismissDate}
            defaultValue={defaultDate < minDate ? minDate : defaultDate}
            min={minDate}
            required
            error={errors.date ?? common}
          />
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {m.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              {m.dismiss}
            </Button>
          </div>
        </form>
      </Sheet>
    </Card>
  );
}
