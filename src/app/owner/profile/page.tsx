import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { PasswordForm } from "@/components/account/AccountForms";
import { AccountSummary } from "@/components/account/AccountSummary";
import { MobileContent } from "@/components/mobile/MobileShell";
import { Button, ButtonLink, Card, Skeleton } from "@/components/ui";
import { IconChevronLeft, IconLogout } from "@/components/ui/icons";
import { t } from "@/i18n";
import { getAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { requireSession } from "@/lib/session";

const p = t.manage.profile;

export const metadata: Metadata = { title: p.title };

async function Profile() {
  const session = await requireSession(["owner"]);
  const [user, company] = await Promise.all([getAccount(session), api.company.get()]);
  return (
    <>
      <AccountSummary user={user} companyName={company.name} />
      <Card as="section" aria-labelledby="own-panel" padding="lg" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="own-panel" className="font-display text-xl font-bold tracking-display">
            {p.panel}
          </h2>
          <p className="text-body text-muted">{p.panelText}</p>
        </div>
        <ButtonLink href="/app/payroll" variant="secondary" fullWidth>
          {p.openPanel}
        </ButtonLink>
      </Card>
      <PasswordForm contact={user.contact} />
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="secondary"
          size="xl"
          fullWidth
          icon={<IconLogout size={18} />}
        >
          {p.logout}
        </Button>
      </form>
    </>
  );
}

export default function OwnerProfilePage() {
  return (
    <MobileContent className="pb-10">
      <Link
        href="/owner"
        className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold no-underline"
      >
        <IconChevronLeft size={18} />
        {p.back}
      </Link>
      <h1 className="font-display text-title font-extrabold tracking-display">{p.title}</h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-card-lg" />}>
        <Profile />
      </Suspense>
    </MobileContent>
  );
}
