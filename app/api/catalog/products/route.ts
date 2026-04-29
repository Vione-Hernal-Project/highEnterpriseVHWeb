import { NextResponse } from "next/server";

import { loadPublishedCatalogProductsPage, resolveCategoryFilter, resolveDepartmentFilter } from "@/lib/products";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;

function getSafeInteger(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = getSafeInteger(url.searchParams.get("offset"), 0);
    const requestedLimit = getSafeInteger(url.searchParams.get("limit"), DEFAULT_PAGE_SIZE);
    const limit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE);
    const department = resolveDepartmentFilter(url.searchParams.get("department"));
    const category = resolveCategoryFilter(url.searchParams.get("category"));
    const newArrivalsOnly = url.searchParams.get("newArrivals") === "true";
    const page = await loadPublishedCatalogProductsPage({
      offset,
      limit,
      department,
      category,
      newArrivalsOnly,
    });

    return NextResponse.json(page);
  } catch {
    return NextResponse.json(
      {
        error: "Unable to load products right now.",
        products: [],
        hasMore: false,
        total: 0,
      },
      { status: 500 },
    );
  }
}
