import Link from "next/link";
import { Archive, ArrowLeft, Circle, Package, PackageX, ShoppingBag } from "lucide-react";

import { AdminPageHeader, AdminStatCard, AdminStatusBadge, AdminTableShell, EmptyAdminState } from "@/components/admin/admin-ui";
import { requireAdminArea } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { getCatalogPriceLabel } from "@/lib/catalog";
import { getErrorMessage } from "@/lib/http";
import { loadAdminCatalogProducts } from "@/lib/products";
import { formatDateTime } from "@/lib/utils";

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

function getStockLabel(stock: number) {
  if (stock <= 0) {
    return "0 out of stock";
  }

  if (stock <= 2) {
    return `${stock} low stock`;
  }

  return `${stock} in stock`;
}

function getInventoryStatus(stock: number) {
  if (stock <= 0) {
    return "out of stock";
  }

  if (stock <= 2) {
    return "low stock";
  }

  return "in stock";
}

function formatProductDate(product: CatalogProduct) {
  const value = product.updatedAt || product.publishedAt || product.createdAt;
  return value ? formatDateTime(value) : "No timestamp";
}

export default async function AdminProductInventoryPage() {
  await requireAdminArea("products");
  let products: CatalogProduct[] = [];
  let loadError = "";

  try {
    products = await loadAdminCatalogProducts();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load inventory value right now.");
  }

  const inventoryRows = products
    .map((product) => {
      const stock = getProductStock(product);
      return {
        product,
        stock,
        stockLabel: getStockLabel(stock),
        inventoryStatus: getInventoryStatus(stock),
        valuePhpCents: product.pricePhpCents * stock,
      };
    })
    .sort((firstRow, secondRow) => secondRow.valuePhpCents - firstRow.valuePhpCents);
  const activeRows = inventoryRows.filter((row) => row.product.status === "published");
  const lowStockRows = inventoryRows.filter((row) => row.stock > 0 && row.stock <= 2);
  const outOfStockRows = inventoryRows.filter((row) => row.stock <= 0);
  const totalUnits = inventoryRows.reduce((total, row) => total + row.stock, 0);
  const totalValuePhpCents = inventoryRows.reduce((total, row) => total + row.valuePhpCents, 0);
  const activeValuePhpCents = activeRows.reduce((total, row) => total + row.valuePhpCents, 0);

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Inventory Value" subtitle="Retail inventory value, stock exposure, and replenishment watch list.">
        <Link className="vh-admin-action-button" href="/admin/products">
          <ArrowLeft size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Products</span>
        </Link>
      </AdminPageHeader>

      {loadError ? <div className="vh-admin-alert"><p>{loadError}</p></div> : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--five" aria-label="Inventory value metrics">
        <AdminStatCard href="/admin/products/inventory" label="Total Value" value={getCatalogPriceLabel(totalValuePhpCents)} delta="Retail inventory value" icon={Package} active />
        <AdminStatCard href="/admin/products" label="Total Products" value={products.length} delta={`${totalUnits} total units`} tone="blue" icon={ShoppingBag} />
        <AdminStatCard href="/admin/products?tab=Active" label="Active Value" value={getCatalogPriceLabel(activeValuePhpCents)} delta={`${activeRows.length} published items`} tone="green" icon={Circle} />
        <AdminStatCard href="/admin/products?inventory=low-stock" label="Low Stock" value={lowStockRows.length} delta="Watch list" tone="gold" icon={Archive} />
        <AdminStatCard href="/admin/products?inventory=out-of-stock" label="Out of Stock" value={outOfStockRows.length} delta="Needs restock" tone="rose" icon={PackageX} />
      </section>

      {!loadError ? (
        <AdminTableShell tabs={["All", "Active", "Low Stock", "Out of Stock"]} searchPlaceholder="Search inventory..." filters={["Inventory Value", "Stock Status", "Filter"]}>
          <table className="vh-admin-table vh-admin-table--products">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all inventory products" /></th>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Unit Price</th>
                <th>Stock</th>
                <th>Retail Value</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.length ? (
                inventoryRows.map((row) => (
                  <tr
                    key={row.product.id}
                    data-admin-table-row="true"
                    data-admin-row-id={row.product.id}
                    data-admin-row-href={`/product/${encodeURIComponent(row.product.id)}`}
                    data-admin-status={`${row.product.status === "published" ? "active" : row.product.status} ${row.inventoryStatus}`}
                  >
                    <td><input type="checkbox" aria-label={`Select ${row.product.name}`} /></td>
                    <td>
                      <div className="vh-admin-product-cell">
                        <img src={row.product.image} alt={row.product.name} />
                        <span>
                          <strong>{row.product.name}</strong>
                          <small>{row.product.description}</small>
                        </span>
                      </div>
                    </td>
                    <td>{row.product.id}</td>
                    <td>{row.product.categoryLabel}</td>
                    <td>{getCatalogPriceLabel(row.product.pricePhpCents)}</td>
                    <td className={row.stock <= 2 ? "vh-admin-table__danger" : "vh-admin-table__success"}>{row.stockLabel}</td>
                    <td>{getCatalogPriceLabel(row.valuePhpCents)}</td>
                    <td>
                      <AdminStatusBadge tone={row.product.status === "published" ? "active" : "draft"}>
                        {row.product.status === "published" ? "Active" : "Draft"}
                      </AdminStatusBadge>
                    </td>
                    <td>{formatProductDate(row.product)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyAdminState title="No inventory records yet." copy="Products will appear here after they are created." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      ) : null}

      <section className="vh-admin-panel">
        <div className="vh-admin-panel__header">
          <div>
            <h2>Inventory Value History</h2>
            <p>Daily inventory snapshots can be listed here once historical stock tracking is connected.</p>
          </div>
        </div>
        <div className="vh-admin-empty-state">
          <strong>No historical snapshots yet.</strong>
          <p>This overview uses current catalog inventory and retail pricing.</p>
        </div>
      </section>
    </div>
  );
}
