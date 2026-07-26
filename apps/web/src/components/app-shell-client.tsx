"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartDonutIcon,
  CircleHalfIcon,
  DiamondsFourIcon,
  EnvelopeSimpleIcon,
  GearIcon,
  ListBulletsIcon,
  ListIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  TagIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useTheme } from "@/components/theme-provider";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: "regular" | "fill" }>;
  badge?: number;
};

const COLLAPSE_KEY = "ng-sidebar-collapsed";

function useNavItems(reviewBadge: number, inboxBadge: number): NavItem[] {
  return [
    { href: "/", label: "Resumen", icon: ChartDonutIcon },
    { href: "/accounts", label: "Cuentas", icon: BankIcon },
    { href: "/transactions", label: "Movimientos", icon: ListBulletsIcon },
    { href: "/review", label: "Por categorizar", icon: TagIcon, badge: reviewBadge },
    { href: "/inbox", label: "Correos", icon: EnvelopeSimpleIcon, badge: inboxBadge },
    { href: "/settings", label: "Configuración", icon: GearIcon },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function ThemeSegment({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  const seg = (on: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 rounded-lg font-medium ${
      compact ? "py-2 text-[13px]" : "py-2.5 text-[13px]"
    } ${on ? "bg-surface text-text" : "bg-transparent text-muted"}`;
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-surface-2 p-[3px]">
      <button type="button" onClick={() => setMode("light")} className={seg(mode === "light")}>
        <SunIcon size={15} /> Claro
      </button>
      <button type="button" onClick={() => setMode("dark")} className={seg(mode === "dark")}>
        <MoonIcon size={15} /> Oscuro
      </button>
      <button type="button" onClick={() => setMode("system")} className={seg(mode === "system")}>
        <CircleHalfIcon size={15} /> Auto
      </button>
    </div>
  );
}

function NavList({
  items,
  expanded,
  onNavigate,
}: {
  items: NavItem[];
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-[3px]">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            onClick={onNavigate}
            className={`ng-nav-item ${active ? "ng-nav-item-active" : ""}`}
          >
            <Icon size={19} weight={active ? "fill" : "regular"} />
            {expanded && <span className="flex-1 truncate">{item.label}</span>}
            {expanded && !!item.badge && item.badge > 0 && (
              <span className="flex-none rounded-full bg-warn px-2 py-px text-[11px] font-semibold text-on-accent">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShellClient({
  userEmail,
  title,
  description,
  actions,
  reviewBadge,
  inboxBadge,
  children,
}: {
  userEmail: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  reviewBadge: number;
  inboxBadge: number;
  children: React.ReactNode;
}) {
  const items = useNavItems(reviewBadge, inboxBadge);
  const { resolvedTheme, cycle } = useTheme();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored === "1") setCollapsed(true);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const expanded = !mobile && !collapsed;

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {!mobile && (
        <aside
          className="sticky top-0 flex h-screen flex-none flex-col gap-6 bg-surface p-3 shadow-[1px_0_0_var(--line)]"
          style={{ width: expanded ? 244 : 68 }}
        >
          <div className="flex min-h-8 items-center gap-2.5 px-1.5">
            <span className="grid size-[30px] flex-none place-items-center rounded-lg bg-accent text-on-accent">
              <DiamondsFourIcon size={16} weight="fill" />
            </span>
            {expanded && (
              <span className="text-[13px] font-semibold tracking-[0.14em]">NEOGILD</span>
            )}
            <span className="flex-1" />
            {expanded && (
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Colapsar"
                className="grid size-7 place-items-center rounded-md border-none bg-transparent text-faint hover:bg-surface-2 hover:text-text"
              >
                <CaretLeftIcon size={16} />
              </button>
            )}
          </div>

          <NavList items={items} expanded={expanded} />

          <div className="flex flex-col gap-3">
            {expanded && <ThemeSegment />}
            <div className="flex items-center gap-2.5 px-1">
              <span className="grid size-[30px] flex-none place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-strong">
                {userEmail.slice(0, 1).toUpperCase()}
              </span>
              {expanded && (
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                  {userEmail}
                </span>
              )}
              {expanded && (
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    title="Salir"
                    className="grid size-[30px] place-items-center rounded-md border-none bg-transparent text-faint hover:bg-surface-2 hover:text-text"
                  >
                    <SignOutIcon size={17} />
                  </button>
                </form>
              )}
            </div>
            {!expanded && (
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Expandir"
                className="grid h-8 w-full place-items-center rounded-lg border-none bg-transparent text-faint hover:bg-surface-2 hover:text-text"
              >
                <CaretRightIcon size={16} />
              </button>
            )}
          </div>
        </aside>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-bg px-4 py-3 shadow-[0_1px_0_var(--line)]">
          {mobile && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className="grid size-10 flex-none place-items-center rounded-lg border border-line bg-transparent text-text hover:bg-surface"
            >
              <ListIcon size={20} />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {!mobile && (
              <h1 className="m-0 truncate text-[19px] font-medium tracking-tight">{title}</h1>
            )}
            {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
          </div>
          {mobile && (
            <button
              type="button"
              onClick={cycle}
              aria-label="Cambiar tema"
              className="grid size-10 flex-none place-items-center rounded-lg border border-line bg-transparent text-text hover:bg-surface"
            >
              {resolvedTheme === "dark" ? <MoonIcon size={19} /> : <SunIcon size={19} />}
            </button>
          )}
        </div>

        {mobile && (
          <div className="px-4 pt-1">
            <h1 className="m-0 truncate text-lg font-medium tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
        )}
        {!mobile && description && (
          <p className="px-4 pt-1 text-sm text-muted">{description}</p>
        )}

        <div className={mobile ? "px-4 py-4" : "px-8 py-5"}>{children}</div>
      </main>

      {mobile && drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            onClick={() => setDrawerOpen(false)}
            className="ng-fade absolute inset-0 bg-[rgba(11,12,20,0.62)]"
          />
          <div className="ng-slide-in relative flex h-full w-[286px] max-w-[82vw] flex-col gap-6 bg-surface p-4 shadow-[var(--shadow)]">
            <div className="flex items-center gap-2.5">
              <span className="grid size-[30px] flex-none place-items-center rounded-lg bg-accent text-on-accent">
                <DiamondsFourIcon size={16} weight="fill" />
              </span>
              <span className="flex-1 text-[13px] font-semibold tracking-[0.14em]">NEOGILD</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="grid size-8 place-items-center rounded-lg border-none bg-transparent text-muted hover:bg-surface-2"
              >
                <XIcon size={19} />
              </button>
            </div>
            <NavList items={items} expanded onNavigate={() => setDrawerOpen(false)} />
            <div className="flex flex-col gap-3.5">
              <ThemeSegment compact />
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 flex-none place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-strong">
                  {userEmail.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{userEmail}</span>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    title="Salir"
                    className="grid size-8 place-items-center rounded-lg border-none bg-transparent text-faint hover:bg-surface-2"
                  >
                    <SignOutIcon size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
