import { ShieldCheck, UserCog, Users } from "lucide-react";

import { ProfileRoleForm } from "@/components/admin/profile-role-form";
import { AdminPageHeader, AdminStatCard, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-ui";
import { requireManagementUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

export default async function AdminProfilesPage() {
  const { role } = await requireManagementUser();

  let profiles: Array<Record<string, any>> = [];
  let loadError = "";

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").select("*").order("created_at", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      profiles = data || [];
    }
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load profile access records right now.");
  }

  const managementProfiles = profiles.filter((profile) => ["owner", "admin", "staff"].includes(profile.role));

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Access" subtitle="Manage internal profile roles and owner permissions." />

      {loadError ? <div className="vh-admin-alert"><p>{loadError}</p></div> : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--3">
        <AdminStatCard href="/admin/profiles" label="Total Profiles" value={profiles.length} delta={`Effective role: ${role}`} icon={Users} />
        <AdminStatCard href="/admin/profiles?tab=Management" label="Management Users" value={managementProfiles.length} delta="Owner/admin/staff profiles" tone="purple" icon={ShieldCheck} />
        <AdminStatCard href="/admin/profiles?tab=Customers" label="Customers" value={Math.max(0, profiles.length - managementProfiles.length)} delta="Standard user profiles" tone="blue" icon={UserCog} />
      </section>

      <AdminTableShell tabs={["All Profiles", "Management", "Customers"]} searchPlaceholder="Search profiles..." filters={["Filter"]}>
        <table className="vh-admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all profiles" /></th>
              <th>Profile</th>
              <th>User ID</th>
              <th>Role</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length ? (
              profiles.map((profile) => (
                <tr key={profile.id} data-admin-table-row="true" data-admin-row-id={profile.id} data-admin-status={profile.role || "user"}>
                  <td><input type="checkbox" aria-label={`Select ${profile.email || profile.id}`} /></td>
                  <td>
                    <div className="vh-admin-customer-cell">
                      <div aria-hidden="true">{String(profile.email || "U").slice(0, 1).toUpperCase()}</div>
                      <span><strong>{profile.email || "No email recorded"}</strong><small>Internal profile</small></span>
                    </div>
                  </td>
                  <td>{profile.id}</td>
                  <td><AdminStatusBadge tone={profile.role === "owner" ? "processing" : "active"}>{profile.role || "user"}</AdminStatusBadge></td>
                  <td>{formatDateTime(profile.created_at)}</td>
                  <td>{formatDateTime(profile.updated_at)}</td>
                  <td>
                    <div className="vh-admin-row-actions">
                      <ProfileRoleForm profileId={profile.id} initialRole={profile.role || "user"} disabled={profile.role === "owner"} />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="vh-admin-empty-state"><strong>No profiles yet.</strong><p>Profiles will appear after users sign in.</p></div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
