"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, Modal, useToast, type ButtonProps } from "@/components/ui";
import { t } from "@/i18n";
import type { ActionResult } from "@/lib/actions";

export interface ConfirmActionProps {
  /** Текст кнопки */
  children: ReactNode;
  title: string;
  text?: string;
  confirmLabel?: string;
  /** Тост после успеха */
  done?: string;
  /** Server Action (с уже привязанными аргументами) */
  action: () => Promise<ActionResult | void>;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  fullWidth?: boolean;
  icon?: ReactNode;
  /** Опасное действие — красная кнопка подтверждения */
  danger?: boolean;
  "aria-label"?: string;
}

/** Кнопка с подтверждением в модалке: «Отметить выплаченной», «Удалить», «Вернуть в расчёт». */
export function ConfirmAction({
  children,
  title,
  text,
  confirmLabel,
  done,
  action,
  variant = "primary",
  size,
  fullWidth,
  icon,
  danger,
  "aria-label": ariaLabel,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result || result.ok) {
        setOpen(false);
        if (done) toast.show({ title: done });
      } else {
        setError(result.fields ? Object.values(result.fields).join(" ") : result.error);
      }
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        icon={icon}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={title}
        description={text}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t.ui.cancel}
            </Button>
            <Button variant={danger ? "danger" : "primary"} onClick={confirm} loading={pending}>
              {confirmLabel ?? t.manage.payroll.confirm}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
