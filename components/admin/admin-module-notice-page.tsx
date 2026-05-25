import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-ui";

type Props = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  backHref: string;
  backLabel: string;
  note: string;
};

export function AdminModuleNoticePage({ title, subtitle, icon: Icon, backHref, backLabel, note }: Props) {
  return (
    <div className="vh-admin-page">
      <AdminPageHeader title={title} subtitle={subtitle}>
        <Link className="vh-admin-action-button" href={backHref}>
          {backLabel}
        </Link>
      </AdminPageHeader>

      <section className="vh-admin-panel vh-admin-module-notice">
        <span className="vh-admin-table-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </section>
    </div>
  );
}
