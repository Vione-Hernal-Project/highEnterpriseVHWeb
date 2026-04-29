import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

import "@/app/globals.css";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { PageTransition } from "@/components/site/page-transition";
import { getCurrentUserContext } from "@/lib/auth";
import { JsonLd, organizationJsonLd, siteName, siteUrl, defaultSeoDescription } from "@/lib/seo";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | Blockchain Fashion And Minimal Luxury`,
    template: `%s | ${siteName}`,
  },
  description: defaultSeoDescription,
  applicationName: siteName,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: `${siteName} | Blockchain Fashion And Minimal Luxury`,
    description: defaultSeoDescription,
    url: siteUrl,
    siteName,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );

  let signedIn = false;
  let isManagementUser = false;

  if (hasSupabaseEnv) {
    const context = await getCurrentUserContext();
    signedIn = Boolean(context.user);
    isManagementUser = context.isManagementUser;
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&family=Oswald:wght@700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://is4.fwrdassets.com/fw_4653ebc37119b026a2595fd10e8f3b6dd89bfaad/fw_src/main/dist/chrome.css"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-9K8H1W9NQJ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-9K8H1W9NQJ');
  `}
        </Script>
      </head>
      <body>
        <JsonLd data={organizationJsonLd()} />
        <div className="vh-app-shell">
          <SiteHeader signedIn={signedIn} isManagementUser={isManagementUser} />
          <main id="page-content" className="vh-main">
            <div className="container">
              <Suspense fallback={children}>
                <PageTransition>{children}</PageTransition>
              </Suspense>
            </div>
          </main>
          <SiteFooter signedIn={signedIn} />
        </div>
      </body>
    </html>
  );
}
