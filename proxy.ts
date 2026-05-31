import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/api/settings/favicon";

    return NextResponse.rewrite(rewriteUrl);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/favicon.ico", "/dashboard/:path*", "/checkout/:path*", "/admin/:path*"],
};
