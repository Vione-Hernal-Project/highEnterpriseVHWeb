import Link from "next/link";
import { Archive, ArrowLeft, Circle, Package, PackageX, ShoppingBag } from "lucide-react";

import { AdminPageHeader, AdminStatCard, AdminStatusBadge, EmptyAdminState } from "@/components/admin/admin-ui";
import { requireAdminArea } from "@/lib/auth";
import {
  CATALOG_MENS_DEPARTMENT,
  CATALOG_UNISEX_DEPARTMENT,
  CATALOG_WOMENS_DEPARTMENT,
  getCatalogPriceLabel,
  normalizeCatalogDepartment,
  type CatalogProduct,
} from "@/lib/catalog";
import { getErrorMessage } from "@/lib/http";
import { loadAdminCatalogProducts } from "@/lib/products";

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

function getDeploymentLabel(department: string) {
  const normalizedDepartment = normalizeCatalogDepartment(department);

  if (normalizedDepartment === CATALOG_WOMENS_DEPARTMENT) {
    return "Women";
  }

  if (normalizedDepartment === CATALOG_MENS_DEPARTMENT) {
    return "Men";
  }

  if (normalizedDepartment === CATALOG_UNISEX_DEPARTMENT) {
    return "Both";
  }

  return department || "Unassigned";
}

function getDeploymentSections(products: CatalogProduct[]) {
  const knownDepartments = [CATALOG_WOMENS_DEPARTMENT, CATALOG_MENS_DEPARTMENT, CATALOG_UNISEX_DEPARTMENT];
  const sections = [
    {
      label: "Women",
      value: CATALOG_WOMENS_DEPARTMENT,
      products: products.filter((product) => normalizeCatalogDepartment(product.department) === CATALOG_WOMENS_DEPARTMENT),
    },
    {
      label: "Men",
      value: CATALOG_MENS_DEPARTMENT,
      products: products.filter((product) => normalizeCatalogDepartment(product.department) === CATALOG_MENS_DEPARTMENT),
    },
    {
      label: "Both",
      value: CATALOG_UNISEX_DEPARTMENT,
      products: products.filter((product) => normalizeCatalogDepartment(product.department) === CATALOG_UNISEX_DEPARTMENT),
    },
  ];
  const otherProducts = products.filter((product) => !knownDepartments.includes(normalizeCatalogDepartment(product.department)));

  return otherProducts.length ? [...sections, { label: "Other", value: "other", products: otherProducts }] : sections;
}

export default async function AdminProductCatalogPage() {
  await requireAdminArea("products");
  let products: CatalogProduct[] = [];
  let loadError = "";

  try {
    products = await loadAdminCatalogProducts();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load the product catalog right now.");
  }

  const publishedProducts = products.filter((product) => product.status === "published");
  const featuredProducts = products.filter((product) => product.showInFeatured);
  const newArrivalProducts = products.filter((product) => product.showInNewArrivals);
  const outOfStockProducts = products.filter((product) => getProductStock(product) <= 0);
  const catalogSections = getDeploymentSections(products);

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Product Catalog" subtitle="Organized overview of all existing catalog items.">
        <Link className="vh-admin-action-button" href="/admin/products">
          <ArrowLeft size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Products</span>
        </Link>
      </AdminPageHeader>

      {loadError ? <div className="vh-admin-alert"><p>{loadError}</p></div> : null}

      <section className="vh-admin-stats-grid vh-admin-stats-grid--five" aria-label="Catalog metrics">
        <AdminStatCard href="/admin/products/catalog" label="Total Products" value={products.length} delta="catalog records" icon={ShoppingBag} active />
        <AdminStatCard href="/admin/products?tab=Active" label="Published" value={publishedProducts.length} delta="active storefront items" tone="green" icon={Circle} />
        <AdminStatCard href="/admin/products" label="Featured" value={featuredProducts.length} delta="featured items" tone="purple" icon={Archive} />
        <AdminStatCard href="/admin/products" label="New Arrivals" value={newArrivalProducts.length} delta="new arrival items" tone="blue" icon={Package} />
        <AdminStatCard href="/admin/products?inventory=out-of-stock" label="Out of Stock" value={outOfStockProducts.length} delta="needs restock" tone="rose" icon={PackageX} />
      </section>

      {!loadError ? (
        <section className="vh-admin-catalog-page" aria-label="Product catalog">
          {products.length ? (
            catalogSections.map((section) => (
              <section className="vh-admin-catalog-section" key={section.value} aria-labelledby={`catalog-section-${section.value}`}>
                <div className="vh-admin-catalog-section__header">
                  <div>
                    <p className="vh-mvp-eyebrow">Deploy To</p>
                    <h2 id={`catalog-section-${section.value}`}>{section.label}</h2>
                  </div>
                  <span>{section.products.length} total</span>
                </div>

                {section.products.length ? (
                  <div className="vh-admin-catalog-grid">
                    {section.products.map((product) => {
                      const stock = getProductStock(product);

                      return (
                        <article className="vh-admin-catalog-card" key={product.id}>
                          <img className="vh-admin-catalog-card__image" src={product.image} alt={product.name} />
                          <div className="vh-admin-catalog-card__copy">
                            <div className="vh-admin-catalog-card__title-row">
                              <div>
                                <p className="vh-product-option__brand">{product.brand}</p>
                                <h3>{product.name}</h3>
                              </div>
                              <AdminStatusBadge tone={product.status === "published" ? "active" : "draft"}>
                                {product.status === "published" ? "Published" : "Draft"}
                              </AdminStatusBadge>
                            </div>
                            <p className="vh-admin-catalog-card__price">{getCatalogPriceLabel(product.pricePhpCents)}</p>
                            <dl className="vh-admin-catalog-card__details">
                              <div>
                                <dt>SKU</dt>
                                <dd>{product.id}</dd>
                              </div>
                              <div>
                                <dt>Category</dt>
                                <dd>{product.categoryLabel}</dd>
                              </div>
                              <div>
                                <dt>Deploy To</dt>
                                <dd>{getDeploymentLabel(product.department)}</dd>
                              </div>
                              <div>
                                <dt>Stock</dt>
                                <dd>{getStockLabel(stock)}</dd>
                              </div>
                            </dl>
                            <div className="vh-admin-catalog-card__flags" aria-label={`${product.name} visibility`}>
                              {product.showInFeatured ? <span>Featured</span> : null}
                              {product.showInNewArrivals ? <span>New</span> : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="vh-admin-catalog-empty">No {section.label.toLowerCase()} products yet.</div>
                )}
              </section>
            ))
          ) : (
            <EmptyAdminState title="No catalog items yet." copy="Products will appear here after they are created." />
          )}
        </section>
      ) : null}
    </div>
  );
}
