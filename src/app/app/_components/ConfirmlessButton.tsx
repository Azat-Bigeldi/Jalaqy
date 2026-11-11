"use client";

import { useTransition, type ReactNode } from "react";
import { Button, useToast, type ButtonProps } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

/** Кнопка, которая сразу запускает Server Action и показывает тост. */
export function ConfirmlessButton({
  children,
  action,
  done,
  label,
  variant = "soft",
  icon,
}: {
  children: ReactNode;
  action: () => Promise<ActionResult>;
  done: string;
  label?: string;
  variant?: ButtonProps["variant"];
  icon?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="md"
      variant={variant}
      icon={icon}
      loading={pending}
      aria-label={label}
      onClick={() =>
        startTransition(async () => {
          const r = await action();
          toast.show(r.ok ? { title: done } : { title: r.error, tone: "error" });
        })
      }
    >
      {children}
    </Button>
  );
}
