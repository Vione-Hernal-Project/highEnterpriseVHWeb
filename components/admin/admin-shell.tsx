"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpenText,
  Boxes,
  CalendarDays,
  FileBarChart,
  FileText,
  Home,
  ImageIcon,
  Layers3,
  LogOut,
  Mail,
  Megaphone,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  Star,
  Tag,
  Users,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { AdminRoutePrefetcher } from "@/components/admin/admin-route-prefetcher";
import { useBrandingAssets } from "@/components/branding/branding-assets";
import {
  getAdminRoleLabel,
  getDefaultAdminHref,
  hasAdminAccess,
  type AdminAccessArea,
  type AdminRole,
} from "@/lib/admin/access";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  ordersActionableCount?: number;
  adminRole: AdminRole | null;
  userEmail: string;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: Home, exact: true, area: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, area: "orders" },
  { href: "/admin/products", label: "Products", icon: Package, area: "products" },
  { href: "/admin/collections", label: "Collections", icon: Boxes, area: "collections" },
  { href: "/admin/customers", label: "Customers", icon: Users, area: "customers" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, area: "reviews" },
  { href: "/admin/coupons", label: "Coupons", icon: Tag, area: "coupons" },
  { href: "/admin/blog", label: "Blog", icon: BookOpenText, area: "content" },
  { href: "/admin/pages", label: "Pages", icon: FileText, area: "content" },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon, area: "content" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, area: "reports" },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone, area: "marketing" },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart, area: "reports" },
  { href: "/admin/settings", label: "Settings", icon: Settings, area: "settings" },
] satisfies Array<{ href: string; label: string; icon: typeof Home; exact?: boolean; area: AdminAccessArea }>;

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPathnameFromHref(href: string) {
  try {
    return new URL(href, "https://admin.local").pathname;
  } catch {
    return href.split(/[?#]/)[0] || "/admin";
  }
}

function isPrimaryNavigationEvent(event: MouseEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function AdminShell({ children, ordersActionableCount = 0, adminRole, userEmail }: Props) {
  const pathname = usePathname();
  const branding = useBrandingAssets();
  const defaultAdminHref = getDefaultAdminHref(adminRole);
  const roleLabel = getAdminRoleLabel(adminRole);
  const visibleNavItems = useMemo(() => NAV_ITEMS.filter((item) => hasAdminAccess(adminRole, item.area)), [adminRole]);
  const [activePathname, setActivePathname] = useState(pathname);
  const [ordersBadgeCount, setOrdersBadgeCount] = useState(ordersActionableCount);

  useEffect(() => {
    setActivePathname(pathname);
  }, [pathname]);

  useEffect(() => {
    setOrdersBadgeCount(ordersActionableCount);
  }, [ordersActionableCount]);

  useEffect(() => {
    let cancelled = false;

    async function refreshBadges() {
      if (!hasAdminAccess(adminRole, "orders")) {
        return;
      }

      try {
        const response = await fetch("/api/admin/badges", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = await response.json() as { ordersActionableCount?: number };

        if (!cancelled) {
          setOrdersBadgeCount(Math.max(0, Number(payload.ordersActionableCount || 0)));
        }
      } catch {
        // Badge refresh should never block admin navigation.
      }
    }

    void refreshBadges();

    window.addEventListener("focus", refreshBadges);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshBadges);
    };
  }, [adminRole]);

  const primeSidebarNavigation = (href: string) => {
    setActivePathname(getPathnameFromHref(href));
  };

  return (
    <section className="vh-admin-system">
      <AdminRoutePrefetcher />
      <aside className="vh-admin-sidebar" aria-label="Vione Hernal admin navigation">
        <Link
          className="vh-admin-sidebar__brand"
          href={defaultAdminHref}
          prefetch={false}
          aria-label="Vione Hernal admin dashboard"
          onClick={(event) => {
            if (isPrimaryNavigationEvent(event)) {
              primeSidebarNavigation(defaultAdminHref);
            }
          }}
          onPointerDown={(event) => {
            if (isPrimaryNavigationEvent(event)) {
              primeSidebarNavigation(defaultAdminHref);
            }
          }}
        >
          <span>{branding.storeName.toUpperCase()}</span>
          <small>ADMIN PANEL</small>
        </Link>

        <nav className="vh-admin-sidebar__nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(activePathname, item.href, item.exact);
            const badge = item.href === "/admin/orders" && ordersBadgeCount > 0 ? String(ordersBadgeCount) : undefined;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn("vh-admin-sidebar__link", active && "vh-admin-sidebar__link--active")}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  if (isPrimaryNavigationEvent(event)) {
                    primeSidebarNavigation(item.href);
                  }
                }}
                onPointerDown={(event) => {
                  if (isPrimaryNavigationEvent(event)) {
                    primeSidebarNavigation(item.href);
                  }
                }}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
                {badge ? <b>{badge}</b> : null}
              </Link>
            );
          })}
        </nav>

        <div className="vh-admin-sidebar__account">
          <div className="vh-admin-sidebar__monogram">
            <img loading="lazy" decoding="async" src={branding.logoUrl || "/assets/images/vh-logo-v2.jpg"} alt="" />
          </div>
          <div>
            <strong>{branding.storeName}</strong>
            <span>Administrator</span>
            <span>{roleLabel}</span>
            <small>{userEmail}</small>
          </div>
        </div>

        <div className="vh-admin-sidebar__footer">
          {hasAdminAccess(adminRole, "ledger") ? <Link
            href="/admin/ledger/transactions?date=all"
            prefetch={false}
            onClick={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/ledger/transactions?date=all");
              }
            }}
            onPointerDown={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/ledger/transactions?date=all");
              }
            }}
          >
            <CalendarDays size={16} strokeWidth={1.8} aria-hidden="true" />
            Transaction History
          </Link> : null}
          {hasAdminAccess(adminRole, "ledger") ? <Link
            href="/admin/ledger/distribution"
            prefetch={false}
            onClick={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/ledger/distribution");
              }
            }}
            onPointerDown={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/ledger/distribution");
              }
            }}
          >
            <Layers3 size={16} strokeWidth={1.8} aria-hidden="true" />
            Allocation Rules
          </Link> : null}
          {hasAdminAccess(adminRole, "wallet-settings") ? <Link
            href="/admin/settings/payment-methods"
            prefetch={false}
            onClick={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/settings/payment-methods");
              }
            }}
            onPointerDown={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/settings/payment-methods");
              }
            }}
          >
            <Percent size={16} strokeWidth={1.8} aria-hidden="true" />
            Payment Methods
          </Link> : null}
          {hasAdminAccess(adminRole, "settings") ? <Link
            href="/admin/settings/email"
            prefetch={false}
            onClick={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/settings/email");
              }
            }}
            onPointerDown={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/settings/email");
              }
            }}
          >
            <Mail size={16} strokeWidth={1.8} aria-hidden="true" />
            Email Settings
          </Link> : null}
          {hasAdminAccess(adminRole, "settings") ? <Link
            href="/admin/settings/notifications"
            prefetch={false}
            onClick={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/settings/notifications");
              }
            }}
            onPointerDown={(event) => {
              if (isPrimaryNavigationEvent(event)) {
                primeSidebarNavigation("/admin/settings/notifications");
              }
            }}
          >
            <Bell size={16} strokeWidth={1.8} aria-hidden="true" />
            Notifications
          </Link> : null}
          <LogoutButton className="vh-admin-sidebar__logout" redirectTo="/" variant="button">
            <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
            Log out
          </LogoutButton>
        </div>
      </aside>

      <main className="vh-admin-main">{children}</main>
    </section>
  );
}
