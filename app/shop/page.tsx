import type { Metadata } from "next";
import Link from "next/link";

import { PaginatedProductCatalog } from "@/components/storefront/paginated-product-catalog";
import { CatalogRefreshListener } from "@/components/storefront/catalog-refresh-listener";
import { CATALOG_UNISEX_DEPARTMENT, catalogProductMatchesDepartment, type CatalogProduct } from "@/lib/catalog";
import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_DEPARTMENT_OPTIONS,
  loadPublishedCatalogProducts,
  resolveCategoryFilter,
  resolveDepartmentFilter,
} from "@/lib/products";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Shop Blockchain Fashion And Luxury Streetwear",
  description: "Shop Vione Hernal minimal luxury fashion, designer streetwear, bags, shoes, and blockchain-ready pieces.",
  path: "/shop",
});

export const dynamic = "force-dynamic";

const SHOP_DEPARTMENT_OPTIONS = PRODUCT_DEPARTMENT_OPTIONS.filter((department) => department !== CATALOG_UNISEX_DEPARTMENT);

type Props = {
  searchParams: Promise<{
    department?: string;
    category?: string;
  }>;
};

function getFilteredProducts(products: CatalogProduct[], filters: { department?: string | null; category?: string | null }) {
  return products.filter((product) => {
    const departmentMatches = filters.department ? catalogProductMatchesDepartment(product.department, filters.department) : true;
    const categoryMatches = filters.category ? product.categoryLabel === filters.category : true;

    return departmentMatches && categoryMatches;
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const { department: rawDepartment, category: rawCategory } = await searchParams;
  const requestedDepartment = resolveDepartmentFilter(rawDepartment);
  const activeDepartment = requestedDepartment && PRODUCT_DEPARTMENT_OPTIONS.some((department) => department === requestedDepartment) ? requestedDepartment : null;
  const requestedCategory = resolveCategoryFilter(rawCategory);
  const activeCategory = requestedCategory && PRODUCT_CATEGORY_OPTIONS.some((category) => category === requestedCategory) ? requestedCategory : null;
  const activeFilterLabel = [activeDepartment, activeCategory].filter(Boolean).join(" / ");
  const pageSize = 20;
  const products = await loadPublishedCatalogProducts();
  const filteredProducts = getFilteredProducts(products, {
    department: activeDepartment,
    category: activeCategory,
  });

  return (
    <section className="storefront-app-view vh-shop-page">
      <CatalogRefreshListener />
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
        initialHasMore={filteredProducts.length > pageSize}
        initialProducts={filteredProducts.slice(0, pageSize)}
        initialTotal={filteredProducts.length}
        pageSize={pageSize}
        clientProducts={products}
        shopFilters={{
          categoryOptions: PRODUCT_CATEGORY_OPTIONS,
          departmentOptions: SHOP_DEPARTMENT_OPTIONS,
        }}
      />
    </section>
  );
}
