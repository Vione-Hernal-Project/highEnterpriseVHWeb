import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const MUTATING_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);

function isSameOriginRequest(request: NextRequest) {
  const requestOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === requestOrigin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/api/settings/favicon";

    return NextResponse.rewrite(rewriteUrl);
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (MUTATING_METHODS.has(request.method.toUpperCase()) && !isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/favicon.ico", "/api/:path*", "/dashboard/:path*", "/checkout/:path*", "/admin/:path*"],
};
