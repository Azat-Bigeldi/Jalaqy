"use client";

import { submitWith } from "@/lib/form-submit";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Banner, Button, Card, Input, RadioGroup } from "@/components/ui";
import { interpolate, t } from "@/i18n";
import { formatKzPhone } from "@/lib/validation/contact";
import {
  requestCodeAction,
  verifyCodeAction,
  type RequestCodeState,
  type VerifyState,
} from "../actions";

const l = t.auth.login;

export function LoginForm({ next, demo }: { next?: string; demo: boolean }) {
  const [codeState, requestCode, requesting] = useActionState<RequestCodeState, FormData>(
    requestCodeAction,
    null,
  );
  const [verifyState, verify, verifying] = useActionState<VerifyState, FormData>(
    verifyCodeAction,
    null,
  );
  // «Изменить номер» относится к конкретному ответу: новый ответ сбрасывает режим сам
  const [editedFor, setEditedFor] = useState<RequestCodeState>(null);
  // null до первого тика: Date.now() нельзя вызывать при пререндере
  const [now, setNow] = useState<number | null>(null);

  const sent = codeState?.ok && editedFor !== codeState ? codeState.data : undefined;

  useEffect(() => {
    if (!sent) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [sent]);

  const resendIn = !sent
    ? 0
    : now === null
      ? sent.resendInSec
      : Math.max(0, Math.ceil(sent.resendInSec - (now - sent.sentAt) / 1000));

  if (!sent) {
    const err = codeState && !codeState.ok ? codeState : null;
    return (
      <Card padding="lg" radius="sheet" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-title font-extrabold tracking-display">{l.title}</h1>
          <p className="text-body text-muted">{l.subtitle}</p>
        </div>
        <form
          action={requestCode}
          onSubmit={submitWith(requestCode)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Input
            name="contact"
            label={l.contact}
            placeholder={l.contactPlaceholder}
            autoComplete="username"
            inputMode="email"
            required
            defaultValue={codeState?.ok ? codeState.data?.contact : undefined}
            error={err?.fields?.contact ?? (err && !err.fields ? err.error : undefined)}
          />
          <Button type="submit" size="xl" fullWidth loading={requesting}>
            {l.getCode}
          </Button>
        </form>
        <Link href="/onboarding" className="text-center text-body font-semibold">
          {l.newCompany}
        </Link>
      </Card>
    );
  }

  const shown = sent.contact.includes("@")
    ? sent.contact
    : formatKzPhone(sent.contact.replace(/[^\d+]/g, "").replace(/^8/, "+7"));
  const err = verifyState && !verifyState.ok ? verifyState : null;

  return (
    <Card padding="lg" radius="sheet" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title font-extrabold tracking-display">{l.codeTitle}</h1>
        <p className="text-body text-muted" role="status">
          {interpolate(sent.channel === "email" ? l.codeSentEmail : l.codeSentSms, {
            contact: shown,
          })}
        </p>
      </div>
      <form
        action={verify}
        onSubmit={submitWith(verify)}
        className="flex flex-col gap-4"
        noValidate
      >
        <input type="hidden" name="contact" value={sent.contact} />
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          // переход ко второму шагу: фокус сразу на поле кода
          autoFocus
          name="code"
          label={l.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          pattern="\d{4}"
          required
          className="font-display text-2xl tracking-[0.3em] tabular-nums"
          error={err?.fields?.code ?? (err && !err.fields ? err.error : undefined)}
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
        <Button type="submit" size="xl" fullWidth loading={verifying}>
          {l.signIn}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="md" onClick={() => setEditedFor(codeState)}>
          {l.change}
        </Button>
        {resendIn > 0 ? (
          <span className="flex min-h-11 items-center text-sm text-muted" aria-live="off">
            {interpolate(l.resendIn, { sec: resendIn })}
          </span>
        ) : (
          <form action={requestCode} onSubmit={submitWith(requestCode)}>
            <input type="hidden" name="contact" value={sent.contact} />
            <Button type="submit" variant="ghost" size="md" loading={requesting}>
              {l.resend}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
