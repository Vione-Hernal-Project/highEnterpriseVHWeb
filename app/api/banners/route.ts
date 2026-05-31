import { NextResponse } from "next/server";

import { isMissingBannersTableError, loadPublishedBannersForPath } from "@/lib/banners";
import { getErrorMessage } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "/";
    const banners = await loadPublishedBannersForPath(path);

    return NextResponse.json({ banners });
  } catch (error) {
    if (isMissingBannersTableError(error)) {
      return NextResponse.json({ banners: [] });
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to load banners right now.") }, { status: 500 });
  }
}
