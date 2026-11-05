import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { t } from "@/i18n";
import { api, isDemo } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { PageSkeleton } from "../_components/PageSkeleton";
import { CompanyForm } from "./CompanyForm";
import { ResetDemo } from "./ResetDemo";
import { UsersSection } from "./UsersSection";

export const metadata: Metadata = { title: t.settings.title };

async function SettingsView() {
  await requireSession(["accountant", "owner"]);
  const [company, users] = await Promise.all([api.company.get(), api.company.users()]);
  return (
    <>
      <PageHeader title={t.settings.title} />
      <CompanyForm company={company} />
      <UsersSection users={users} />
      {isDemo && <ResetDemo />}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} rows={4} />}>
      <SettingsView />
    </Suspense>
  );
}
