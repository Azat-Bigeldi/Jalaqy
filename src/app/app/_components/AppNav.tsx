import { MobileNavBar, Sidebar } from "@/components/ui";
import { redirect } from "next/navigation";
import { IconLogout, IconUser } from "@/components/ui/icons";
import { logoutAction } from "@/app/(auth)/actions";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { appNav, appNavFooter } from "./nav";

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center gap-3 rounded-nav px-3 text-left text-body font-semibold text-on-ink-soft transition-colors is-hover:bg-ink-hover is-hover:text-white"
      >
        <IconLogout size={18} />
        {t.ui.logout}
      </button>
    </form>
  );
}

/** Сайдбар (≥1024px) и шапка с выезжающим меню (<1024px). */
export async function AppNav() {
  const session = await requireSession(["accountant", "owner"]);
  const company = await api.company.get();
  // Новая компания: сначала реквизиты и сотрудники
  if (!company.onboarded) redirect("/onboarding");
  const props = {
    items: appNav,
    footerItems: [
      ...appNavFooter,
      { href: "/app/profile", label: session.name, icon: <IconUser size={18} /> },
    ],
    companyLabel: t.app.shell.companyLabel,
    companyName: company.name,
    footer: <LogoutButton />,
  };
  return (
    <>
      {/* колонка тянется на всю высоту страницы, сам сайдбар прилипает к экрану */}
      <div className="hidden w-[230px] shrink-0 bg-ink lg:block">
        <Sidebar {...props} className="sticky top-0 h-dvh overflow-y-auto" />
      </div>
      <MobileNavBar {...props} className="sticky top-0 z-30 lg:hidden" />
    </>
  );
}

/** Пока грузится компания: тот же каркас без текста. */
export function AppNavFallback() {
  return (
    <>
      <div
        aria-hidden="true"
        className="sticky top-0 hidden h-dvh w-[230px] shrink-0 bg-ink lg:block"
      />
      <div aria-hidden="true" className="h-14 bg-ink lg:hidden" />
    </>
  );
}
