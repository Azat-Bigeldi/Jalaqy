import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/i18n";
import { today } from "@/lib/clock";
import { connection } from "next/server";
import { isDemo } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = { title: t.auth.onboarding.title };

async function Wizard() {
  await connection();
  // С базой онбординг заполняет компанию того, кто вошёл: без входа — на вход
  if (!isDemo) await requireSession(["accountant", "owner"]);
  return <OnboardingWizard defaultHireDate={today()} />;
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
