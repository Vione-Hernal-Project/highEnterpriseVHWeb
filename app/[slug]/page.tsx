import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublishedSitePageBySlug, type SitePageRecord } from "@/lib/site-pages";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function getPageParagraphs(page: SitePageRecord) {
  return page.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPublishedSitePageBySlug(slug);

  if (!page) {
    return createSeoMetadata({
      title: "Page Not Found",
      path: `/${slug}`,
      noIndex: true,
    });
  }

  return createSeoMetadata({
    title: page.metaTitle || page.title,
    description: page.metaDescription,
    path: page.href,
  });
}

export default async function CmsSitePage({ params }: Props) {
  const { slug } = await params;
  const page = await loadPublishedSitePageBySlug(slug);

  if (!page) {
    notFound();
  }

  const paragraphs = getPageParagraphs(page);

  return (
    <article className="storefront-app-view">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: page.title, path: page.href },
        ])}
      />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>{page.title}</span>
      </nav>
      <div className="storefront-app-hero">
        <p className="u-text--sm u-uppercase u-margin-b--sm">{page.pageType || "Page"}</p>
        <h1 className="h2 u-margin-b--md">{page.title}</h1>
        {page.metaDescription ? <p className="u-margin-b--none">{page.metaDescription}</p> : null}
      </div>
      {page.featuredImageUrl ? (
        <div className="storefront-app-media u-margin-b--xl">
          <img src={page.featuredImageUrl} alt="" />
        </div>
      ) : null}
      <section className="vh-about-page__sections">
        <article className="vh-about-page__section">
          <p className="vh-about-page__section-label">Page Content</p>
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </section>
    </article>
  );
}
