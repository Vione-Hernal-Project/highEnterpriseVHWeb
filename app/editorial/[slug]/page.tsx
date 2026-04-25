import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCatalogProductPageHref } from "@/lib/catalog";
import { editorialArticles, getEditorialArticle } from "@/lib/editorial";
import { loadPublishedCatalogProducts } from "@/lib/products";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return editorialArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getEditorialArticle(slug);

  if (!article) {
    return createSeoMetadata({
      title: "Editorial Not Found",
      path: `/editorial/${slug}`,
      noIndex: true,
    });
  }

  return createSeoMetadata({
    title: article.title,
    description: article.description,
    path: `/editorial/${article.slug}`,
  });
}

export default async function EditorialArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getEditorialArticle(slug);

  if (!article) {
    notFound();
  }

  const products = await loadPublishedCatalogProducts();
  const linkedProducts = article.productLinks
    .map((productId) => products.find((product) => product.id === productId))
    .filter(Boolean);

  return (
    <article className="storefront-app-view">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Editorial", path: "/editorial" },
          { name: article.title, path: `/editorial/${article.slug}` },
        ])}
      />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/editorial">Editorial</Link>
        <span>/</span>
        <span>{article.title}</span>
      </nav>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">{article.eyebrow}</p>
        <h1 className="h2 u-margin-b--md">{article.title}</h1>
        <p className="u-margin-b--none">{article.description}</p>
      </div>
      <section className="vh-about-page__sections">
        {article.sections.map((section) => (
          <article key={section.heading} className="vh-about-page__section">
            <p className="vh-about-page__section-label">{section.heading}</p>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        ))}
      </section>
      <section className="u-screen-reader" aria-label="Editorial internal links">
        <h2>Continue Exploring</h2>
        <ul>
          {article.relatedLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
          {linkedProducts.map((product) => (
            <li key={product!.id}>
              <Link href={getCatalogProductPageHref(product!.id)}>{product!.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
