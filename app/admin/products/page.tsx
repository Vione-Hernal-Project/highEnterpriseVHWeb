import Link from "next/link";

import { ProductManager } from "@/components/admin/product-manager";
import { requireManagementUser } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { getErrorMessage } from "@/lib/http";
import { loadAdminCatalogProducts } from "@/lib/products";

export default async function AdminProductsPage() {
  const { role } = await requireManagementUser();
  let products: CatalogProduct[] = [];
  let loadError = "";

  try {
    products = await loadAdminCatalogProducts();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load the product manager right now.");
  }

  return (
    <section className="vh-page-shell">
      <div className="vh-data-card">
        <p className="vh-mvp-eyebrow">Product Management</p>
        <h1 className="vh-mvp-title">Upload, draft, and publish products without editing code.</h1>
        <p className="vh-mvp-copy">
          Effective role: {role}. Use this page to launch new items with images, sizes, stock, Featured Items, and New Arrivals visibility,
          while keeping the existing storefront layout intact.
        </p>
        <div className="vh-actions">
          <Link className="vh-button vh-button--ghost" href="/admin">
            Back To Admin
          </Link>
          <Link className="vh-button vh-button--ghost" href="/shop">
            Open Shop
          </Link>
          <Link className="vh-button vh-button--ghost" href="/new">
            Open New Arrivals
          </Link>
        </div>
        {loadError ? <div className="vh-status vh-status--error">{loadError}</div> : null}
      </div>

      {!loadError ? <ProductManager initialProducts={products} /> : null}
    </section>
  );
}
