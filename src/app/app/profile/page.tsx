import type { Metadata } from "next";
import { Suspense } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { PasswordForm } from "@/components/account/AccountForms";
import { AccountSummary } from "@/components/account/AccountSummary";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";
import { IconLogout } from "@/components/ui/icons";
import { t } from "@/i18n";
import { getAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { PageSkeleton } from "../_components/PageSkeleton";

const p = t.manage.profile;

export const metadata: Metadata = { title: p.title };

async function ProfileView() {
  const session = await requireSession(["accountant", "owner"]);
  const [user, company] = await Promise.all([getAccount(session), api.company.get()]);
  return (
    <>
      <PageHeader title={p.title} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AccountSummary user={user} companyName={company.name} />
        <div className="flex min-w-0 flex-col gap-4">
          <PasswordForm contact={user.contact} />
          {session.role === "owner" && (
            <Card
              as="section"
              aria-labelledby="acc-owner"
              padding="lg"
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex max-w-sm flex-col gap-1">
                <h2 id="acc-owner" className="font-display text-xl font-bold tracking-display">
                  {p.ownerScreen}
                </h2>
                <p className="text-body text-muted">{p.ownerScreenText}</p>
              </div>
              <ButtonLink href="/owner" variant="secondary">
                {p.openOwner}
              </ButtonLink>
            </Card>
          )}
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" icon={<IconLogout size={18} />}>
              {p.logout}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} rows={4} />}>
      <ProfileView />
    </Suspense>
  );
}
