"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type PublicBanner = {
  id: string;
  title: string;
  linkUrl: string | null;
  linkTarget: "same_window" | "new_tab";
  imageUrl: string | null;
  mobileImageUrl: string | null;
  heading: string;
  subheading: string;
  description: string;
  buttonText: string;
  displayOn: string;
  device: string;
};

function bannerDeviceClass(device: string) {
  if (device === "Desktop Only") {
    return "vh-site-banner--desktop";
  }

  if (device === "Mobile Only") {
    return "vh-site-banner--mobile";
  }

  return "";
}

function BannerContent({ banner }: { banner: PublicBanner }) {
  const imageUrl = banner.imageUrl || banner.mobileImageUrl;

  return (
    <>
      {imageUrl ? <img src={imageUrl} alt="" /> : null}
      <span className="vh-site-banner__copy">
        {banner.subheading ? <small>{banner.subheading}</small> : null}
        <strong>{banner.heading || banner.title}</strong>
        {banner.description ? <span>{banner.description}</span> : null}
      </span>
      {banner.buttonText ? <b>{banner.buttonText}</b> : null}
    </>
  );
}

export function SiteBanners() {
  const pathname = usePathname();
  const [banners, setBanners] = useState<PublicBanner[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadBanners() {
      const response = await fetch(`/api/banners?path=${encodeURIComponent(pathname || "/")}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { banners?: PublicBanner[] } | null;

      if (!cancelled) {
        setBanners(Array.isArray(payload?.banners) ? payload.banners : []);
      }
    }

    void loadBanners();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!banners.length) {
    return null;
  }

  return (
    <aside className="vh-site-banners" aria-label="Site banners">
      {banners.map((banner) => {
        const className = ["vh-site-banner", bannerDeviceClass(banner.device)].filter(Boolean).join(" ");
        const trackingProps = {
          "data-vh-banner-id": banner.id,
          "data-vh-banner-location": banner.displayOn,
          "data-vh-banner-title": banner.title,
        };

        if (banner.linkUrl) {
          const external = banner.linkTarget === "new_tab";

          return (
            <Link
              key={banner.id}
              className={className}
              href={banner.linkUrl}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              {...trackingProps}
            >
              <BannerContent banner={banner} />
            </Link>
          );
        }

        return (
          <div key={banner.id} className={className} role="note" {...trackingProps}>
            <BannerContent banner={banner} />
          </div>
        );
      })}
    </aside>
  );
}
