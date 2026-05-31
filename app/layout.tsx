import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import "@/app/globals.css";

import { BannerGaEvents } from "@/components/analytics/banner-ga-events";
import { BrandingFaviconUpdater } from "@/components/branding/branding-assets";
import { CookieConsent } from "@/components/cookie-consent/CookieConsent";
import { MarketingAttributionCapture } from "@/components/marketing/marketing-attribution-capture";
import { SiteFrame } from "@/components/site/site-frame";
import { loadPublicBrandingSettings, loadPublicStorefrontSettings, versionAssetUrl } from "@/lib/admin/settings";
import { JsonLd, organizationJsonLd, siteName, siteUrl, siteDomain, officialOnlineStoreTitle, defaultSeoDescription } from "@/lib/seo";
import Script from "next/script";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await loadPublicBrandingSettings();
  const resolvedSiteName = branding.storeName || siteName;
  const faviconUrl = versionAssetUrl("/favicon.ico", branding.brandingVersion);
  const logoUrl = versionAssetUrl(branding.logoUrl || "/assets/images/vh-logo-v2.jpg", branding.brandingVersion);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: resolvedSiteName === siteName ? officialOnlineStoreTitle : `${resolvedSiteName} Official Online Store | ${siteDomain}`,
      template: `%s | ${siteDomain}`,
    },
    description: defaultSeoDescription,
    applicationName: resolvedSiteName,
    icons: {
      icon: [{ url: faviconUrl }],
      apple: [{ url: logoUrl }],
      shortcut: [faviconUrl],
    },
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      title: resolvedSiteName === siteName ? officialOnlineStoreTitle : `${resolvedSiteName} Official Online Store | ${siteDomain}`,
      description: defaultSeoDescription,
      url: siteUrl,
      siteName: resolvedSiteName,
      type: "website",
      images: logoUrl ? [{ url: logoUrl, alt: resolvedSiteName }] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    },
  };
}

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const storefrontSettings = await loadPublicStorefrontSettings();

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
      </head>
      <body>
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
        <JsonLd data={organizationJsonLd()} />
        <SiteFrame storefrontSettings={storefrontSettings}>{children}</SiteFrame>
        <BrandingFaviconUpdater />
        <Suspense fallback={null}>
          <MarketingAttributionCapture />
        </Suspense>
        <BannerGaEvents />
        <CookieConsent />
      </body>
    </html>
  );
}
