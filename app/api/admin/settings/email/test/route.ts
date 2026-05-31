import { NextResponse } from "next/server";
import { z } from "zod";

import { loadFreshAdminGeneralSettings } from "@/lib/admin/settings";
import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { sendAdminTestEmail } from "@/lib/email";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";

const TEST_EMAIL_BODY_LIMIT_BYTES = 8 * 1024;

const emailSettingsPayloadSchema = z.object({
  fromName: z.string().trim().max(120, "From name is too long."),
  fromEmail: z.string().trim().email("From email must be valid.").max(160, "From email is too long."),
  replyToEmail: z.string().trim().email("Reply-to email must be valid.").max(160, "Reply-to email is too long."),
  emailProvider: z.string().trim().max(60, "Email provider is too long."),
  emailSslEnabled: z.boolean(),
});

const testEmailPayloadSchema = z.object({
  to: z.string().trim().email("Test email recipient must be valid.").max(160, "Test email recipient is too long."),
  settings: emailSettingsPayloadSchema.partial().optional(),
});

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "settings")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, TEST_EMAIL_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = testEmailPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid test email payload." }, { status: 400 });
    }

    const savedSettings = await loadFreshAdminGeneralSettings();
    const emailSettings = {
      fromName: parsed.data.settings?.fromName ?? savedSettings.fromName,
      fromEmail: parsed.data.settings?.fromEmail ?? savedSettings.fromEmail,
      replyToEmail: parsed.data.settings?.replyToEmail ?? savedSettings.replyToEmail,
      emailProvider: parsed.data.settings?.emailProvider ?? savedSettings.emailProvider,
      emailSslEnabled: parsed.data.settings?.emailSslEnabled ?? savedSettings.emailSslEnabled,
    };

    const result = await sendAdminTestEmail({
      to: parsed.data.to,
      settings: emailSettings,
    });

    return NextResponse.json({
      sentAt: result.sentAt,
      message: "Test email sent successfully",
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to send test email right now.") }, { status: 500 });
  }
}
