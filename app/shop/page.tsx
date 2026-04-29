import type { Metadata } from "next";
import Link from "next/link";

import { PaginatedProductCatalog } from "@/components/storefront/paginated-product-catalog";
import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_DEPARTMENT_OPTIONS,
  getProductFilterSlug,
  loadPublishedCatalogProductsPage,
  resolveCategoryFilter,
  resolveDepartmentFilter,
} from "@/lib/products";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Shop Blockchain Fashion And Luxury Streetwear",
  description: "Shop Vione Hernal minimal luxury fashion, designer streetwear, bags, shoes, and blockchain-ready pieces.",
  path: "/shop",
});

type Props = {
  searchParams: Promise<{
    department?: string;
    category?: string;
  }>;
};

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
  const requestedDepartment = resolveDepartmentFilter(rawDepartment);
  const activeDepartment = requestedDepartment && PRODUCT_DEPARTMENT_OPTIONS.some((department) => department === requestedDepartment) ? requestedDepartment : null;
  const requestedCategory = resolveCategoryFilter(rawCategory);
  const activeCategory = requestedCategory && PRODUCT_CATEGORY_OPTIONS.some((category) => category === requestedCategory) ? requestedCategory : null;
  const activeFilterLabel = [activeDepartment, activeCategory].filter(Boolean).join(" / ");
  const initialPage = await loadPublishedCatalogProductsPage({
    offset: 0,
    limit: 20,
    department: activeDepartment,
    category: activeCategory,
  });

  return (
    <section className="storefront-app-view vh-shop-page">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Shop</span>
      </nav>

      <PaginatedProductCatalog
        activeFilterLabel={activeFilterLabel}
        emptyAction={
          <Link className="vh-button" href="/">
            Back Home
          </Link>
        }
        emptyMessage={activeFilterLabel ? `No published products match ${activeFilterLabel}.` : "No published products are available yet."}
        filters={{
          department: activeDepartment,
          category: activeCategory,
        }}
        hero={{
          eyebrow: "Published Collection",
          title: "Shop",
          copy: "Published collection",
        }}
        initialHasMore={initialPage.hasMore}
        initialProducts={initialPage.products}
        initialTotal={initialPage.total}
        toolbar={
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
                {PRODUCT_DEPARTMENT_OPTIONS.map((department) => (
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
                {PRODUCT_CATEGORY_OPTIONS.map((category) => (
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
        }
      />
    </section>
  );
}
