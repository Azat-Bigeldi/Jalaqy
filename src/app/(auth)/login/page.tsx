import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { t } from "@/i18n";
import { isDemo } from "@/lib/api";
import { getSession } from "@/lib/session";
import { homeFor, safeNext } from "@/lib/session-codec";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: t.auth.login.title };

async function LoginWithNext({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // уже вошли — сразу на свой экран
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return <LoginForm next={safeNext(next) ?? undefined} demo={isDemo} />;
}

function LoginSkeleton() {
  return (
    <Card padding="lg" radius="sheet" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">{t.ui.loading}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-[54px] w-full" />
    </Card>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const [before, after] = t.auth.login.privacy.split("{link}");
  return (
    <>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginWithNext searchParams={searchParams as Promise<{ next?: string }>} />
      </Suspense>
      <p className="text-center text-caption text-muted">
        {before}
        <Link href="/privacy">{t.auth.login.privacyLink}</Link>
        {after}
      </p>
    </>
  );
}
