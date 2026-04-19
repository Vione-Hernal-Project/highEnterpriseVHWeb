import Link from "next/link";

import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getProductFilterSlug,
  loadPublishedCatalogProducts,
  resolveCategoryFilter,
  resolveDepartmentFilter,
} from "@/lib/products";

type Props = {
  searchParams: Promise<{
    department?: string;
    category?: string;
  }>;
};

function getUniqueLabels(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildShopHref(filters: { department?: string | null; category?: string | null }) {
  const params = new URLSearchParams();

  if (filters.department) {
    params.set("department", getProductFilterSlug(filters.department));
  }

  if (filters.category) {
    params.set("category", getProductFilterSlug(filters.category));
  }

  const query = params.toString();

  return query ? `/shop?${query}` : "/shop";
}

export default async function ShopPage({ searchParams }: Props) {
  const { department: rawDepartment, category: rawCategory } = await searchParams;
  const allProducts = await loadPublishedCatalogProducts();
  const availableDepartments = getUniqueLabels(allProducts.map((product) => product.department));
  const requestedDepartment = resolveDepartmentFilter(rawDepartment);
  const activeDepartment = requestedDepartment && availableDepartments.includes(requestedDepartment) ? requestedDepartment : null;
  const departmentScopedProducts = activeDepartment
    ? allProducts.filter((product) => product.department === activeDepartment)
    : allProducts;
  const availableCategories = getUniqueLabels(departmentScopedProducts.map((product) => product.categoryLabel));
  const requestedCategory = resolveCategoryFilter(rawCategory);
  const activeCategory = requestedCategory && availableCategories.includes(requestedCategory) ? requestedCategory : null;
  const products = activeCategory
    ? departmentScopedProducts.filter((product) => product.categoryLabel === activeCategory)
    : departmentScopedProducts;
  const activeFilterLabel = [activeDepartment, activeCategory].filter(Boolean).join(" / ");

  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Shop</span>
      </nav>

      {products.length ? (
        <>
          <div className="storefront-app-hero">
            <p className="u-text--sm u-uppercase u-margin-b--sm">Published Collection</p>
            <h1 className="h2 u-margin-b--md">Shop</h1>
            <p className="u-margin-b--none">
              {products.length} item{products.length === 1 ? "" : "s"} available
              {activeFilterLabel ? ` in ${activeFilterLabel}` : ""}
            </p>
          </div>

          <div className="vh-shop-filters">
            <div className="vh-shop-filter-group">
              <span className="vh-shop-filter-label">Department</span>
              <div className="vh-shop-filter-links">
                <Link
                  className={`vh-shop-filter-chip ${!activeDepartment ? "vh-shop-filter-chip--active" : ""}`}
                  href={buildShopHref({ category: activeCategory })}
                >
                  All
                </Link>
                {availableDepartments.map((department) => (
                  <Link
                    key={department}
                    className={`vh-shop-filter-chip ${activeDepartment === department ? "vh-shop-filter-chip--active" : ""}`}
                    href={buildShopHref({ department, category: null })}
                  >
                    {department}
                  </Link>
                ))}
              </div>
            </div>

            <div className="vh-shop-filter-group">
              <span className="vh-shop-filter-label">Category</span>
              <div className="vh-shop-filter-links">
                <Link
                  className={`vh-shop-filter-chip ${!activeCategory ? "vh-shop-filter-chip--active" : ""}`}
                  href={buildShopHref({ department: activeDepartment })}
                >
                  All
                </Link>
                {availableCategories.map((category) => (
                  <Link
                    key={category}
                    className={`vh-shop-filter-chip ${activeCategory === category ? "vh-shop-filter-chip--active" : ""}`}
                    href={buildShopHref({ department: activeDepartment, category })}
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <ProductGrid products={products} />
        </>
      ) : (
        <div className="storefront-app-empty">
          <p className="u-margin-b--lg">
            {activeFilterLabel ? `No published products match ${activeFilterLabel}.` : "No published products are available yet."}
          </p>
          <Link className="vh-button" href="/">
            Back Home
          </Link>
        </div>
      )}
    </section>
  );
}
