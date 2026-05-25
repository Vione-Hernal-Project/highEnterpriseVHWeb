import { NextResponse } from "next/server";

import { saveAdminNotificationReadIds } from "@/lib/admin/notification-reads";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const NOTIFICATION_READ_BODY_LIMIT_BYTES = 16 * 1024;

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))].slice(0, 100);
}

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, NOTIFICATION_READ_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null) as { ids?: unknown } | null;
    const ids = normalizeIds(body?.ids);

    if (!ids.length) {
      return NextResponse.json({ readIds: [] });
    }

    const admin = createSupabaseAdminClient();
    const readAt = new Date().toISOString();
    await admin.from("admin_notifications").update({ read_at: readAt }).in("id", ids).is("read_at", null);

    return NextResponse.json({ readIds: await saveAdminNotificationReadIds(user.id, ids) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to mark notifications as read right now.") }, { status: 500 });
  }
}
