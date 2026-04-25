import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { loadAdminCatalogProducts, normalizeProductCategory, normalizeProductDepartment } from "@/lib/products";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminProductSchema } from "@/lib/validations/product";

const ADMIN_PRODUCT_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_PRODUCT_WRITE_LIMIT = 80;
const ADMIN_PRODUCT_BODY_LIMIT_BYTES = 64 * 1024;

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildSizeInventory(rows: Array<{ size: string; stock: number }>) {
  return rows.reduce<Record<string, number>>((inventory, row) => {
    inventory[row.size.trim()] = Math.max(0, Math.floor(row.stock));
    return inventory;
  }, {});
}

function getStoragePathFromPublicUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const marker = "/storage/v1/object/public/product-media/";
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function getProductStoragePaths(product: {
  main_image_url: string;
  hover_image_url: string | null;
  gallery_image_urls: unknown;
}) {
  return Array.from(
    new Set(
      [product.main_image_url, product.hover_image_url, ...parseStringArray(product.gallery_image_urls)]
        .map((url) => getStoragePathFromPublicUrl(url))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function buildProductPayload(input: ReturnType<typeof adminProductSchema.parse>, publishedAt: string | null) {
  return {
    id: input.id,
    name: input.name,
    brand: input.brand,
    description: input.description,
    price_php_cents: input.pricePhpCents,
    department: normalizeProductDepartment(input.department),
    category_label: normalizeProductCategory(input.categoryLabel),
    main_image_url: input.mainImageUrl,
    hover_image_url: input.hoverImageUrl,
    gallery_image_urls: input.galleryImageUrls,
    size_inventory: buildSizeInventory(input.sizeInventoryRows),
    status: input.status,
    show_in_new_arrivals: input.showInNewArrivals,
    show_in_featured: input.showInFeatured,
    published_at: publishedAt,
  };
}

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const products = await loadAdminCatalogProducts();

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load the products right now.") }, { status: 500 });
  }
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

    const bodySizeError = getJsonBodySizeError(request, ADMIN_PRODUCT_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:products:write:user:${user.id}`,
      limit: ADMIN_PRODUCT_WRITE_LIMIT,
      windowMs: ADMIN_PRODUCT_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many product update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: existingProduct, error: existingProductError } = await admin
      .from("products")
      .select("id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (existingProductError) {
      return NextResponse.json({ error: existingProductError.message }, { status: 500 });
    }

    if (existingProduct) {
      return NextResponse.json({ error: "A product with this SKU already exists." }, { status: 409 });
    }

    const publishedAt = parsed.data.status === "published" ? new Date().toISOString() : null;
    const { data, error } = await admin
      .from("products")
      .insert(buildProductPayload(parsed.data, publishedAt))
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to save the product right now." }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the product right now.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_PRODUCT_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:products:write:user:${user.id}`,
      limit: ADMIN_PRODUCT_WRITE_LIMIT,
      windowMs: ADMIN_PRODUCT_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many product update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: existingProduct, error: existingProductError } = await admin
      .from("products")
      .select("id, status, published_at")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (existingProductError) {
      return NextResponse.json({ error: existingProductError.message }, { status: 500 });
    }

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const publishedAt =
      parsed.data.status === "published"
        ? existingProduct.status === "published"
          ? existingProduct.published_at || new Date().toISOString()
          : new Date().toISOString()
        : null;

    const { data, error } = await admin
      .from("products")
      .update(buildProductPayload(parsed.data, publishedAt))
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to update the product right now." }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to update the product right now.") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_PRODUCT_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:products:write:user:${user.id}`,
      limit: ADMIN_PRODUCT_WRITE_LIMIT,
      windowMs: ADMIN_PRODUCT_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many product update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";

    if (!productId) {
      return NextResponse.json({ error: "Product code / SKU is required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: existingProduct, error: existingProductError } = await admin
      .from("products")
      .select("id, main_image_url, hover_image_url, gallery_image_urls")
      .eq("id", productId)
      .maybeSingle();

    if (existingProductError) {
      return NextResponse.json({ error: existingProductError.message }, { status: 500 });
    }

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const { error: deleteError } = await admin.from("products").delete().eq("id", productId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const storagePaths = getProductStoragePaths(existingProduct);

    if (storagePaths.length) {
      await admin.storage.from("product-media").remove(storagePaths);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to remove the product right now.") }, { status: 500 });
  }
}
