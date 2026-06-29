import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Circle, Package, ShoppingBag } from "lucide-react";

import { AdminPageHeader, AdminStatCard, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-ui";
import { requireAdminArea } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { getCatalogPriceLabel } from "@/lib/catalog";
import { loadAdminCollectionRecords, normalizeCollectionKey } from "@/lib/collections";
import { loadAdminCatalogProducts } from "@/lib/products";

type Props = {
  params: Promise<{
    collectionName: string;
  }>;
};

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

export default async function AdminCollectionDetailPage({ params }: Props) {
  await requireAdminArea("collections");
  const { collectionName } = await params;
  const decodedName = decodeURIComponent(collectionName);
  const products = await loadAdminCatalogProducts().catch(() => []);
  const collections = await loadAdminCollectionRecords().catch(() => []);
  const decodedKey = normalizeCollectionKey(decodedName);
  const collection = collections.find((candidate) => candidate.slug === decodedKey || normalizeCollectionKey(candidate.name) === decodedKey) ?? null;
  const collectionProducts = products.filter((product) => normalizeCollectionKey(product.categoryLabel) === (collection ? normalizeCollectionKey(collection.name) : decodedKey));

  if (!collection && !collectionProducts.length) {
    notFound();
  }

  const collectionTitle = collection?.name || decodedName;
  const activeProducts = collectionProducts.filter((product) => product.status === "published");
  const totalValue = collectionProducts.reduce((total, product) => total + product.pricePhpCents * getProductStock(product), 0);

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title={collectionTitle} subtitle={collection?.description || "Collection product list and catalog status."}>
        <Link className="vh-admin-action-button" href="/admin/collections">
          <ArrowLeft size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Back to Collections</span>
        </Link>
      </AdminPageHeader>

      <section className="vh-admin-stats-grid vh-admin-stats-grid--3">
        <AdminStatCard href="/admin/collections" label="Collection Products" value={collectionProducts.length} delta="Assigned products" icon={ShoppingBag} />
        <AdminStatCard href="/admin/products?tab=Active" label="Active Products" value={activeProducts.length} delta="Published items" tone="green" icon={Circle} />
        <AdminStatCard href="/admin/products" label="Retail Value" value={getCatalogPriceLabel(totalValue)} delta="Inventory value" tone="purple" icon={Package} />
      </section>

      <AdminTableShell tabs={["All Products", "Active", "Draft"]} searchPlaceholder="Search collection products..." filters={["All Status", "Filter"]}>
        <table className="vh-admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all collection products" /></th>
              <th>Product</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Inventory</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {collectionProducts.length ? collectionProducts.map((product) => (
              <tr
                key={product.id}
                data-admin-table-row="true"
                data-admin-row-id={product.id}
                data-admin-row-href={`/product/${encodeURIComponent(product.id)}`}
                data-admin-status={product.status === "published" ? "active" : product.status}
              >
                <td><input type="checkbox" aria-label={`Select ${product.name}`} /></td>
                <td>
                  <div className="vh-admin-product-cell">
                    <img loading="lazy" decoding="async" src={product.image} alt={product.name} />
                    <span><strong>{product.name}</strong><small>{product.description}</small></span>
                  </div>
                </td>
                <td>{product.id}</td>
                <td>{getCatalogPriceLabel(product.pricePhpCents)}</td>
                <td>{getProductStock(product)} in stock</td>
                <td><AdminStatusBadge tone={product.status === "published" ? "active" : "draft"}>{product.status === "published" ? "Active" : "Draft"}</AdminStatusBadge></td>
                <td><Link className="vh-admin-view-button" href={`/product/${encodeURIComponent(product.id)}`} target="_blank">View</Link></td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>
                  <div className="vh-admin-empty-state">
                    <strong>No products assigned yet.</strong>
                    <p>Add a product and choose this collection to populate this view.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}
