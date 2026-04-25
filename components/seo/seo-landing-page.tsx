import Link from "next/link";

import { ProductGrid } from "@/components/storefront/product-grid";
import { type CatalogProduct } from "@/lib/catalog";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  products: CatalogProduct[];
  links: Array<{ label: string; href: string }>;
};

export function SeoLandingPage({ eyebrow, title, description, sections, products, links }: Props) {
  return (
    <section className="storefront-app-view">
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>{title}</span>
      </nav>

      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">{eyebrow}</p>
        <h1 className="h2 u-margin-b--md">{title}</h1>
        <p className="u-margin-b--none">{description}</p>
      </div>

      <section className="u-screen-reader" aria-label={`${title} editorial context`}>
        {sections.map((section) => (
          <article key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
        <h2>Explore Vione Hernal</h2>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      {products.length ? <ProductGrid products={products} showCta={false} /> : null}
    </section>
  );
}
