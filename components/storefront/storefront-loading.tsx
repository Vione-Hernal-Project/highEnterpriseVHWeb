export function StorefrontLoading() {
  return (
    <section className="storefront-app-view" aria-busy="true" aria-label="Loading storefront">
      <div className="storefront-app-breadcrumb vh-loading-line vh-loading-line--breadcrumb" />
      <div className="storefront-app-hero">
        <div className="vh-loading-line vh-loading-line--eyebrow" />
        <div className="vh-loading-line vh-loading-line--title" />
        <div className="vh-loading-line vh-loading-line--copy" />
      </div>
      <div className="g n-block-grid--4 product-grids js-product-opt-view vh-loading-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="gc products-grid__item products-grid__item--no-cta">
            <div className="product-grids__link">
              <div className="product-grids__image product__image-container storefront-app-hover-ready vh-loading-block" />
              <div className="product-grids__copy product-grids__copy--no-cta">
                <div className="vh-loading-line vh-loading-line--product" />
                <div className="vh-loading-line vh-loading-line--product-name" />
                <div className="vh-loading-line vh-loading-line--price" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
