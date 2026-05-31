import Link from "next/link";
import { Archive, Circle, Package, PackageX, ShoppingBag } from "lucide-react";

import { ProductManager } from "@/components/admin/product-manager";
import {
  AddButton,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableShell,
  ExportButton,
  MoreActionsButton,
} from "@/components/admin/admin-ui";
import { requireAdminArea } from "@/lib/auth";
import type { CatalogProduct } from "@/lib/catalog";
import { getCatalogPriceLabel } from "@/lib/catalog";
import { buildAdminCollectionOptions, loadAdminCollectionRecords } from "@/lib/collections";
import { getErrorMessage } from "@/lib/http";
import { loadAdminCatalogProducts } from "@/lib/products";

type AdminProductsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    inventory?: string | string[];
    category?: string | string[];
  }>;
};

type InventoryFilter = "all" | "out-of-stock" | "low-stock";
type CategoryFilter = "all" | "uncategorized";

const PRODUCT_TABLE_TABS = ["All Products", "Active", "Draft", "Archived"];

function getProductStock(product: CatalogProduct) {
  return Object.values(product.sizeInventory).reduce((total, stock) => total + stock, 0);
}

function getStockLabel(product: CatalogProduct) {
  const stock = getProductStock(product);

  if (stock <= 0) {
    return "0 out of stock";
  }

  if (stock <= 2) {
    return `${stock} low stock`;
  }

  return `${stock} in stock`;
}

function getProductInventoryStatus(product: CatalogProduct) {
  const stock = getProductStock(product);

  if (stock <= 0) {
    return "out of stock";
  }

  if (stock <= 2) {
    return "low stock";
  }

  return "in stock";
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeFilterValue(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveInventoryFilter(value: string | string[] | undefined): InventoryFilter {
  const normalizedValue = normalizeFilterValue(getFirstParam(value));

  if (normalizedValue === "out of stock") {
    return "out-of-stock";
  }

  if (normalizedValue === "low stock") {
    return "low-stock";
  }

  return "all";
}

function resolveCategoryFilter(value: string | string[] | undefined): CategoryFilter {
  return normalizeFilterValue(getFirstParam(value)) === "uncategorized" ? "uncategorized" : "all";
}

function isUncategorizedProduct(product: CatalogProduct) {
  const category = product.categoryLabel.trim().toLowerCase();
  return !category || category === "uncategorized" || category === "collection";
}

function resolveTableTab(value: string | string[] | undefined) {
  const normalizedValue = normalizeFilterValue(getFirstParam(value));

  return PRODUCT_TABLE_TABS.find((tab) => {
    const normalizedTab = normalizeFilterValue(tab);
    return normalizedTab === normalizedValue || normalizedTab.replace(/^all\s+/, "") === normalizedValue;
  }) || PRODUCT_TABLE_TABS[0];
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  await requireAdminArea("products");
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedInventoryFilter = resolveInventoryFilter(resolvedSearchParams.inventory);
  const selectedCategoryFilter = resolveCategoryFilter(resolvedSearchParams.category);
  const activeTableTab = resolveTableTab(resolvedSearchParams.tab);
  let products: CatalogProduct[] = [];
  let collectionOptions: string[] = [];
  let loadError = "";

  try {
    products = await loadAdminCatalogProducts();
    const collections = await loadAdminCollectionRecords().catch(() => []);
    collectionOptions = buildAdminCollectionOptions(collections, products).map((collection) => collection.name);
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load the product manager right now.");
  }

  const activeProducts = products.filter((product) => product.status === "published");
  const outOfStockProducts = products.filter((product) => getProductStock(product) <= 0);
  const lowStockProducts = products.filter((product) => {
    const stock = getProductStock(product);
    return stock > 0 && stock <= 2;
  });
  const totalValue = products.reduce((total, product) => total + product.pricePhpCents * getProductStock(product), 0) / 100;
  const inventoryFilteredProducts = selectedInventoryFilter === "out-of-stock"
    ? outOfStockProducts
    : selectedInventoryFilter === "low-stock"
      ? lowStockProducts
      : products;
  const tableProducts = selectedCategoryFilter === "uncategorized"
    ? inventoryFilteredProducts.filter(isUncategorizedProduct)
    : inventoryFilteredProducts;
  const activeProductsActive = selectedInventoryFilter === "all" && selectedCategoryFilter === "all" && activeTableTab === "Active";

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Products" subtitle="Manage your store products, inventory and pricing.">
        <ExportButton />
        <MoreActionsButton />
        <AddButton href="#product-editor">Add Product</AddButton>
      </AdminPageHeader>

      {loadError ? <div className="vh-admin-alert"><p>{loadError}</p></div> : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--five" aria-label="Product metrics">
        <AdminStatCard href="/admin/products" label="Total Products" value={products.length} delta="↑ catalog records" icon={ShoppingBag} />
        <AdminStatCard href="/admin/products?tab=Active" label="Active Products" value={activeProducts.length} delta="↑ published items" tone="green" icon={Circle} active={activeProductsActive} />
        <AdminStatCard href="/admin/products?inventory=out-of-stock" label="Out of Stock" value={outOfStockProducts.length} delta="↓ needs restock" tone="rose" icon={PackageX} active={selectedInventoryFilter === "out-of-stock"} />
        <AdminStatCard href="/admin/products?inventory=low-stock" label="Low Stock" value={lowStockProducts.length} delta="↑ watch list" tone="gold" icon={Archive} active={selectedInventoryFilter === "low-stock"} />
        <AdminStatCard href="/admin/products/inventory" label="Total Value" value={getCatalogPriceLabel(totalValue * 100)} delta="↑ retail inventory value" tone="purple" icon={Package} />
      </section>

      {!loadError ? (
        <>
          <AdminTableShell
            tabs={PRODUCT_TABLE_TABS}
            activeTab={activeTableTab}
            searchPlaceholder="Search products..."
            filters={["All Collections", "All Categories", "All Status", "Inventory Status", "Filter"]}
          >
            <table className="vh-admin-table vh-admin-table--products">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all products" /></th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Inventory</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableProducts.length ? (
                  tableProducts.map((product) => (
                    <tr
                      key={product.id}
                      data-admin-table-row="true"
                      data-admin-row-id={product.id}
                      data-admin-row-href={`/product/${encodeURIComponent(product.id)}`}
                      data-admin-status={`${product.status === "published" ? "active" : product.status} ${getProductInventoryStatus(product)}`}
                    >
                      <td><input type="checkbox" aria-label={`Select ${product.name}`} /></td>
                      <td>
                        <div className="vh-admin-product-cell">
                          <img src={product.image} alt={product.name} />
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.description}</small>
                          </span>
                        </div>
                      </td>
                      <td>{product.id}</td>
                      <td>{product.categoryLabel}</td>
                      <td>{getCatalogPriceLabel(product.pricePhpCents)}</td>
                      <td className={getProductStock(product) <= 2 ? "vh-admin-table__danger" : "vh-admin-table__success"}>
                        {getStockLabel(product)}
                      </td>
                      <td>
                        <AdminStatusBadge tone={product.status === "published" ? "active" : "draft"}>
                          {product.status === "published" ? "Active" : "Draft"}
                        </AdminStatusBadge>
                      </td>
                      <td>
                        <div className="vh-admin-row-actions">
                          <Link className="vh-admin-icon-button" href={`/product/${encodeURIComponent(product.id)}`} target="_blank">View</Link>
                          <a className="vh-admin-icon-button" href="#product-editor">Edit</a>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="vh-admin-empty-state">
                        <strong>{selectedCategoryFilter === "uncategorized" ? "No uncategorized products." : "No matching products."}</strong>
                        <p>{selectedCategoryFilter === "uncategorized" ? "Every product is assigned to a collection/category." : "Adjust the selected product filters to view more items."}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </AdminTableShell>

          <section id="product-editor" className="vh-admin-product-workspace">
            <ProductManager initialProducts={products} collectionOptions={collectionOptions} />
          </section>
        </>
      ) : null}
    </div>
  );
}
