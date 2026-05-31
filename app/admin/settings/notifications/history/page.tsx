import Link from "next/link";

import { AdminNotificationHistoryList } from "@/components/admin/admin-notification-history-list";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { loadAdminNotificationHistoryRows } from "@/lib/admin/notifications";
import { requireAdminArea } from "@/lib/auth";

export default async function AdminNotificationHistoryPage() {
  await requireAdminArea("settings");

  const historyRows = await loadAdminNotificationHistoryRows(null);

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Notification History" subtitle="Review all notification records created from real store events.">
        <Link className="vh-admin-action-button" href="/admin/settings/notifications">
          <span>Back To Notifications</span>
        </Link>
      </AdminPageHeader>

      <div className="vh-admin-settings-grid vh-admin-settings-grid--wide">
        <section className="vh-admin-panel vh-admin-panel--wide">
          <div className="vh-admin-panel__header">
            <div>
              <h2>All Notification Records</h2>
              <p>{historyRows.length} total records</p>
            </div>
          </div>
          <AdminNotificationHistoryList rows={historyRows} />
        </section>
      </div>
    </div>
  );
}
