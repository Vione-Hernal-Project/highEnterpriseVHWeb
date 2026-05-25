import type { Metadata } from "next";
import Link from "next/link";

import { editorialArticles } from "@/lib/editorial";
import { loadPublishedBlogPosts } from "@/lib/blog";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Editorial - Blockchain Fashion And Luxury Streetwear",
  description: "Read Vione Hernal editorial notes on blockchain fashion, web3 fashion ownership, and minimal luxury wardrobe building.",
  path: "/editorial",
});

export default async function EditorialPage() {
  const cmsPosts = await loadPublishedBlogPosts();
  const cmsSlugs = new Set(cmsPosts.map((post) => post.slug));
  const articles = [
    ...cmsPosts.map((post) => ({
      slug: post.slug,
      eyebrow: post.categories[0] || "Editorial",
      title: post.title,
      description: post.excerpt || post.metaDescription || "Read the latest Vione Hernal editorial note.",
      href: post.href,
    })),
    ...editorialArticles
      .filter((article) => !cmsSlugs.has(article.slug))
      .map((article) => ({
        slug: article.slug,
        eyebrow: article.eyebrow,
        title: article.title,
        description: article.description,
        href: `/editorial/${article.slug}`,
      })),
  ];

  return (
    <section className="storefront-app-view">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Editorial", path: "/editorial" }])} />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Editorial</span>
      </nav>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">Editorial</p>
        <h1 className="h2 u-margin-b--md">Editorial</h1>
        <p className="u-margin-b--none">Notes on blockchain fashion, minimal luxury, and the future of ownership.</p>
      </div>
      <section className="vh-about-page__sections">
        {articles.map((article) => (
          <article key={article.slug} className="vh-about-page__section">
            <p className="vh-about-page__section-label">{article.eyebrow}</p>
            <h2 className="h3">{article.title}</h2>
            <p>{article.description}</p>
            <Link className="vh-button vh-button--ghost" href={article.href}>
              Read Editorial
            </Link>
          </article>
        ))}
      </section>
    </section>
  );
}
