"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { Dialog } from "./Dialog";
import { IconButton } from "./IconButton";
import { IconMenu } from "./icons";
import { isActivePath, type NavItem } from "./nav";

export interface SidebarProps {
  items: NavItem[];
  /** Пункты внизу (настройки, выход). */
  footerItems?: NavItem[];
  companyLabel: string;
  companyName: string;
  /** Переопределить активный путь (для витрины); по умолчанию — текущий URL. */
  activePath?: string;
  /** Вызывается при переходе по пункту (закрыть мобильное меню). */
  onNavigate?: () => void;
  /** Низ меню: например, кнопка «Выйти». */
  footer?: ReactNode;
  className?: string;
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-nav px-3 text-body font-semibold no-underline transition-colors",
        active
          ? "bg-ink-hover text-white hover:text-white"
          : "text-on-ink-soft is-hover:bg-ink-hover is-hover:text-white",
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        {item.icon}
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

/** Содержимое сайдбара: логотип, компания, меню. Используется и на десктопе, и в мобильном меню. */
export function SidebarContent({
  items,
  footerItems = [],
  companyLabel,
  companyName,
  activePath,
  onNavigate,
  footer,
}: Omit<SidebarProps, "className">) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  return (
    <div className="flex h-full flex-col gap-7">
      <Logo variant="onDark" size={32} wordmarkSize={24} className="px-2" />
      <div className="flex flex-col gap-0.5 px-2">
        <div className="text-xs tracking-[0.08em] text-on-ink-muted uppercase">{companyLabel}</div>
        <div className="text-body font-semibold">{companyName}</div>
      </div>
      <nav aria-label={t.ui.mainNav} className="flex flex-1 flex-col justify-between gap-6">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActivePath(current, item)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {(footerItems.length > 0 || footer) && (
          <ul className="m-0 flex list-none flex-col gap-1 border-t border-ink-divider p-0 pt-4">
            {footerItems.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActivePath(current, item)} onNavigate={onNavigate} />
              </li>
            ))}
            {footer && <li>{footer}</li>}
          </ul>
        )}
      </nav>
    </div>
  );
}

/** Тёмный сайдбар веб-панели (230px). На узких экранах прячьте его и показывайте MobileNavBar. */
export function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <aside className={cn("on-ink w-[230px] shrink-0 bg-ink px-4 py-6 text-on-ink", className)}>
      <SidebarContent {...props} />
    </aside>
  );
}

export interface MobileNavBarProps extends Omit<SidebarProps, "onNavigate" | "className"> {
  /** Справа в шапке (например, уведомления). */
  actions?: ReactNode;
  className?: string;
}

/** Шапка панели на телефоне: логотип + кнопка меню; меню выезжает слева. */
export function MobileNavBar({ actions, className, ...sidebar }: MobileNavBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className={cn(
        "on-ink flex h-14 items-center justify-between gap-2 bg-ink px-2 text-on-ink",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <IconButton
          label={t.ui.openMenu}
          icon={<IconMenu />}
          variant="onInk"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        />
        <Logo variant="onDark" size={28} wordmarkSize={21} />
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.ui.mainNav}
        hideTitle
        variant="drawer"
        tone="ink"
      >
        <SidebarContent {...sidebar} onNavigate={() => setOpen(false)} />
      </Dialog>
    </header>
  );
}
