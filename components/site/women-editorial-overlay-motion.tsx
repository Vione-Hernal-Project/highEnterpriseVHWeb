"use client";

import { useEffect } from "react";

const MOTION_ITEMS = [
  {
    panel: ".vh-home-page .story-hero__video-pane",
    overlay: ".vh-home-page .story-hero__copy-overlay",
    topOffset: 24,
    includePanelOffset: true,
  },
  {
    panel: ".vh-home-page .story-hero__relocated-pane",
    overlay: ".vh-home-page .story-hero__relocated-copy",
    topOffset: 0,
    includePanelOffset: true,
  },
  {
    panel: ".vh-home-page .story-hero__spring-pane",
    overlay: ".vh-home-page .story-hero__spring-copy",
    topOffset: 0,
    includePanelOffset: false,
  },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export function WomenEditorialOverlayMotion() {
  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionItems = MOTION_ITEMS.flatMap((selectors) => {
      const panel = document.querySelector<HTMLElement>(selectors.panel);
      const overlay = document.querySelector<HTMLElement>(selectors.overlay);

      return panel && overlay
        ? [{ panel, overlay, topOffset: selectors.topOffset, includePanelOffset: selectors.includePanelOffset }]
        : [];
    });

    if (motionItems.length === 0 || reducedMotionQuery.matches) {
      return;
    }

    let frame = 0;

    const clearMotion = () => {
      motionItems.forEach(({ panel, overlay }) => {
        panel.classList.remove("story-hero__media-pane--motion");
        overlay.classList.remove("story-hero__copy--motion");
        overlay.style.removeProperty("--vh-women-overlay-panel-top");
        overlay.style.removeProperty("--vh-women-overlay-top");
        overlay.style.removeProperty("--vh-women-overlay-travel");
      });
    };

    const update = () => {
      if (!mobileQuery.matches) {
        clearMotion();
        frame = 0;
        return;
      }

      const viewportHeight = window.innerHeight || 1;
      const lowOffset = clamp(window.innerWidth * 0.042, 20, 66);

      motionItems.forEach(({ panel, overlay, topOffset, includePanelOffset }) => {
        panel.classList.add("story-hero__media-pane--motion");
        overlay.classList.add("story-hero__copy--motion");

        const panelRect = panel.getBoundingClientRect();
        const panelHeight = panelRect.height;
        const overlayHeight = overlay.offsetHeight;

        if (panelHeight <= 0 || overlayHeight <= 0) {
          return;
        }

        const overlayParentRect = overlay.offsetParent?.getBoundingClientRect();
        const panelOffsetTop = includePanelOffset && overlayParentRect ? panelRect.top - overlayParentRect.top : 0;
        const coverProgress = clamp((viewportHeight - panelRect.top) / (viewportHeight + panelHeight), 0, 1);
        const progress = clamp((coverProgress - 0.44) / (0.76 - 0.44), 0, 1);
        const fixedTop = panelHeight * 0.58;
        const lowestTop = panelHeight - lowOffset - overlayHeight / 2;
        const top = clamp(fixedTop + topOffset, overlayHeight / 2 + 8, panelHeight - overlayHeight / 2 - 8);
        const maxTravel = Math.max(lowestTop - top, 0);
        const travel = mix(0, maxTravel, progress);

        overlay.style.setProperty("--vh-women-overlay-panel-top", `${panelOffsetTop}px`);
        overlay.style.setProperty("--vh-women-overlay-top", `${top}px`);
        overlay.style.setProperty("--vh-women-overlay-travel", `${travel}px`);
      });

      frame = 0;
    };

    const requestUpdate = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    mobileQuery.addEventListener("change", requestUpdate);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      mobileQuery.removeEventListener("change", requestUpdate);
      clearMotion();
    };
  }, []);

  return null;
}
