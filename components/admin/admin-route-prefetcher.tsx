"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

function getAdminHref(rawHref: string) {
  try {
    const url = new URL(rawHref, window.location.origin);

    if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) {
      return "";
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

export function AdminRoutePrefetcher() {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(new Set<string>());

  const prefetchAdminHref = useCallback((rawHref: string) => {
    const href = getAdminHref(rawHref);

    if (!href || href === pathname || prefetched.current.has(href)) {
      return;
    }

    prefetched.current.add(href);
    router.prefetch(href);
  }, [pathname, router]);

  useEffect(() => {
    const root = document.querySelector(".vh-admin-system");

    if (!root) {
      return undefined;
    }

    const prefetchFromTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return;
      }

      const element = target.closest<HTMLElement>("a[href], [data-admin-row-href]");

      if (!element || !root.contains(element)) {
        return;
      }

      const href = element instanceof HTMLAnchorElement ? element.href : element.dataset.adminRowHref;

      if (href) {
        prefetchAdminHref(href);
      }
    };

    const prefetchFromEvent = (event: Event) => prefetchFromTarget(event.target);

    root.addEventListener("pointerover", prefetchFromEvent, { passive: true });
    root.addEventListener("focusin", prefetchFromEvent);
    root.addEventListener("touchstart", prefetchFromEvent, { passive: true });

    return () => {
      root.removeEventListener("pointerover", prefetchFromEvent);
      root.removeEventListener("focusin", prefetchFromEvent);
      root.removeEventListener("touchstart", prefetchFromEvent);
    };
  }, [prefetchAdminHref]);

  return null;
}
