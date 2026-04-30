import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

import "@/app/globals.css";

import { CookieConsent } from "@/components/cookie-consent/CookieConsent";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { PageTransition } from "@/components/site/page-transition";
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
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

const cookieConsentBootstrap = `
  (function () {
    var storageKey = "vh_cookie_consent";

    function readConsent() {
      try {
        var rawConsent = window.localStorage.getItem(storageKey);

        if (!rawConsent) return null;

        var consent = JSON.parse(rawConsent);

        if (!consent || !consent.expiresAt || Date.parse(consent.expiresAt) <= Date.now()) {
          window.localStorage.removeItem(storageKey);
          return null;
        }

        return consent;
      } catch (error) {
        return null;
      }
    }

    function getPreferences() {
      var consent = readConsent();

      return {
        essential: true,
        analytics: Boolean(consent && consent.preferences && consent.preferences.analytics),
        marketing: Boolean(consent && consent.preferences && consent.preferences.marketing)
      };
    }

    window.getCookieConsent = readConsent;
    window.canLoadTracking = function (category) {
      if (category === "essential") return true;
      return Boolean(getPreferences()[category]);
    };

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    var preferences = getPreferences();
    window.gtag("consent", "default", {
      analytics_storage: preferences.analytics ? "granted" : "denied",
      ad_storage: preferences.marketing ? "granted" : "denied",
      ad_user_data: preferences.marketing ? "granted" : "denied",
      ad_personalization: preferences.marketing ? "granted" : "denied",
      wait_for_update: 500
    });
  })();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
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
        <Script id="cookie-consent-bootstrap" strategy="beforeInteractive">
          {cookieConsentBootstrap}
        </Script>
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
          <SiteHeader />
          <main id="page-content" className="vh-main">
            <div className="container">
              <Suspense fallback={children}>
                <PageTransition>{children}</PageTransition>
              </Suspense>
            </div>
          </main>
          <SiteFooter signedIn={false} />
        </div>
        <CookieConsent />
      </body>
    </html>
  );
}
