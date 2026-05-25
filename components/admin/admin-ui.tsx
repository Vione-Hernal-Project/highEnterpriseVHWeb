import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { AdminExportButton } from "@/components/admin/admin-export-button";
import { AdminInteractiveTableShell } from "@/components/admin/admin-interactive-table-shell";
import { AdminMoreActionsButton } from "@/components/admin/admin-more-actions-button";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle: string;
  children?: ReactNode;
};

type StatCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  href?: string;
  tone?: "purple" | "green" | "blue" | "gold" | "rose" | "neutral";
  icon: LucideIcon;
  active?: boolean;
};

type ActionButtonProps = {
  href?: string;
  children: ReactNode;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "paid" | "processing" | "pending" | "cancelled" | "shipped" | "active" | "inactive" | "draft";
};

type TableShellProps = {
  tabs?: string[];
  activeTab?: string;
  searchPlaceholder?: string;
  filters?: string[];
  children: ReactNode;
  footer?: ReactNode;
};

export function AdminPageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="vh-admin-page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children ? <div className="vh-admin-page-header__actions">{children}</div> : null}
    </header>
  );
}

export function AdminStatCard({ label, value, delta = "↑ 0% vs last week", href, tone = "purple", icon: Icon, active = false }: StatCardProps) {
  const content = (
    <article className={cn("vh-admin-stat-card", `vh-admin-stat-card--${tone}`, active && "vh-admin-stat-card--selected")}>
      <div className="vh-admin-stat-card__icon">
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{delta}</p>
      </div>
    </article>
  );

  if (href) {
    return (
      <Link className="vh-admin-stat-card-link" href={href} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }

  return content;
}

export function AdminActionButton({ href, children, icon: Icon, variant = "secondary" }: ActionButtonProps) {
  const className = cn("vh-admin-action-button", variant === "primary" && "vh-admin-action-button--primary");
  const content = (
    <>
      {Icon ? <Icon size={16} strokeWidth={1.9} aria-hidden="true" /> : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={className} type="button">
      {content}
    </button>
  );
}

export function ExportButton() {
  return <AdminExportButton />;
}

export function MoreActionsButton() {
  return <AdminMoreActionsButton />;
}

export function AddButton({ href, children }: { href?: string; children: ReactNode }) {
  return (
    <AdminActionButton href={href} icon={Plus} variant="primary">
      {children}
    </AdminActionButton>
  );
}

export function AdminStatusBadge({ children, tone = "active" }: StatusBadgeProps) {
  return <span className={cn("vh-admin-status-badge", `vh-admin-status-badge--${tone}`)}>{children}</span>;
}

export function AdminTableShell({
  tabs = ["All"],
  activeTab = tabs[0],
  searchPlaceholder = "Search...",
  filters = ["Filter"],
  children,
}: TableShellProps) {
  return (
    <AdminInteractiveTableShell tabs={tabs} activeTab={activeTab} searchPlaceholder={searchPlaceholder} filters={filters}>
      {children}
    </AdminInteractiveTableShell>
  );
}

export function AdminPagination({ label }: { label: string }) {
  return (
    <div className="vh-admin-pagination">
      <span>{label}</span>
      <div>
        <button type="button" className="vh-admin-page-button vh-admin-page-button--active">
          1
        </button>
        <button type="button" className="vh-admin-page-button">
          2
        </button>
        <span>...</span>
        <button type="button" className="vh-admin-page-button" aria-label="Next page">
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      <label className="vh-admin-rows-select">
        <span>Rows per page:</span>
        <select defaultValue="10">
          <option value="10">10</option>
          <option value="25">25</option>
        </select>
      </label>
    </div>
  );
}

export function EmptyAdminState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="vh-admin-empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
