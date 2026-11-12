import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NotConfigured } from "@/components/account/NotConfigured";
import { Card, Skeleton } from "@/components/ui";
import { t } from "@/i18n";
import { isConfigured, isDemo } from "@/lib/api";
import { getSession } from "@/lib/session";
import { homeFor } from "@/lib/session-codec";
import { RegisterForm } from "./RegisterForm";

const r = t.manage.register;

export const metadata: Metadata = { title: r.title };

async function Register() {
  // В демо компания одна — сразу к её настройке
  if (isDemo) redirect("/onboarding");
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return (
    <>
      {!isConfigured && <NotConfigured />}
      <RegisterForm needCode={Boolean(process.env.JALAQY_SIGNUP_CODE)} />
    </>
  );
}

export default function RegisterPage() {
  const [before, after] = r.privacy.split("{link}");
  return (
    <>
      <Suspense
        fallback={
          <Card padding="lg" radius="sheet" aria-busy="true" className="flex flex-col gap-5">
            <span className="sr-only">{t.ui.loading}</span>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[54px] w-full" />
          </Card>
        }
      >
        <Register />
      </Suspense>
      <p className="text-center text-caption text-muted">
        {before}
        <Link href="/privacy">{t.auth.login.privacyLink}</Link>
        {after}
      </p>
    </>
  );
}
