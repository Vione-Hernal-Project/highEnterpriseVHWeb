import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  AddButton,
  AdminPageHeader,
  AdminStatCard,
  AdminTableShell,
  ExportButton,
  MoreActionsButton,
} from "@/components/admin/admin-ui";

type Stat = {
  label: string;
  value: string | number;
  delta?: string;
  href?: string;
  tone?: "purple" | "green" | "blue" | "gold" | "rose" | "neutral";
  icon: LucideIcon;
  active?: boolean;
};

type Row = {
  id: string;
  status?: string;
  href?: string;
  cells: ReactNode[];
};

type Props = {
  title: string;
  subtitle: string;
  stats: Stat[];
  tabs: string[];
  activeTab?: string;
  searchPlaceholder: string;
  filters?: string[];
  columns: string[];
  rows: Row[];
  addLabel?: string;
  addHref?: string;
  emptyTitle: string;
  emptyCopy: string;
};

export function AdminSimpleModule({
  title,
  subtitle,
  stats,
  tabs,
  activeTab,
  searchPlaceholder,
  filters,
  columns,
  rows,
  addLabel,
  addHref,
  emptyTitle,
  emptyCopy,
}: Props) {
  return (
    <div className="vh-admin-page">
      <AdminPageHeader title={title} subtitle={subtitle}>
        <ExportButton />
        <MoreActionsButton />
        {addLabel ? <AddButton href={addHref}>{addLabel}</AddButton> : null}
      </AdminPageHeader>

      <section className={`vh-admin-stats-grid vh-admin-stats-grid--${Math.min(Math.max(stats.length, 3), 5)}`} aria-label={`${title} metrics`}>
        {stats.map((stat) => (
          <AdminStatCard key={stat.label} {...stat} />
        ))}
      </section>

      <AdminTableShell tabs={tabs} activeTab={activeTab || tabs[0]} searchPlaceholder={searchPlaceholder} filters={filters}>
        <table className="vh-admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label={`Select all ${title}`} /></th>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-admin-table-row="true"
                  data-admin-row-id={row.id}
                  data-admin-row-href={row.href}
                  data-admin-status={row.status || ""}
                >
                  <td><input type="checkbox" aria-label={`Select ${row.id}`} /></td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${index}`}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1}>
                  <div className="vh-admin-empty-state">
                    <strong>{emptyTitle}</strong>
                    <p>{emptyCopy}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
