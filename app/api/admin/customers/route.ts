import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { CUSTOMER_CACHE_TAG, isMissingCustomersTableError, loadAdminManualCustomers } from "@/lib/customers";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCustomerSchema } from "@/lib/validations/customer";

const ADMIN_CUSTOMER_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_CUSTOMER_WRITE_LIMIT = 60;
const ADMIN_CUSTOMER_BODY_LIMIT_BYTES = 64 * 1024;

function buildCustomerPayload(input: ReturnType<typeof adminCustomerSchema.parse>) {
  return {
    full_name: input.fullName,
    email: input.email.toLowerCase(),
    phone_country_code: input.phoneCountryCode,
    phone_number: input.phoneNumber,
    date_of_birth: input.dateOfBirth,
    customer_type: input.customerType,
    source: input.source,
    customer_group: input.customerGroup,
    vip_level: input.vipLevel,
    referral_by: input.referralBy,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    city: input.city,
    state_province: input.stateProvince,
    postal_code: input.postalCode,
    country: input.country,
    account_status: input.accountStatus,
    email_verification: input.emailVerification,
    has_account_access: input.hasAccountAccess,
    subscription_status: input.subscriptionStatus,
    subscribed_on: input.subscribedOn,
    tags: input.tags,
    notes: input.notes,
  };
}

function getCustomerStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Customer storage is not installed yet. Apply the updated Supabase schema so Add Customer can save real customer records.",
    },
    { status: 501 },
  );
}

export async function GET() {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "customers")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const customers = await loadAdminManualCustomers();

    return NextResponse.json({ customers });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load customers right now.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "customers")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_CUSTOMER_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:customers:write:user:${user.id}`,
      limit: ADMIN_CUSTOMER_WRITE_LIMIT,
      windowMs: ADMIN_CUSTOMER_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many customer update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid customer payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("customers")
      .insert(buildCustomerPayload(parsed.data))
      .select("*")
      .single();

    if (error || !data) {
      if (error && isMissingCustomersTableError(new Error(error.message))) {
        return getCustomerStorageErrorResponse();
      }

      if (error?.code === "23505") {
        return NextResponse.json({ error: "A customer with this email already exists." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message || "Unable to save the customer right now." }, { status: 500 });
    }

    revalidateTag(CUSTOMER_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/customers");

    return NextResponse.json({ customer: data });
  } catch (error) {
    if (isMissingCustomersTableError(error)) {
      return getCustomerStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the customer right now.") }, { status: 500 });
  }
}
