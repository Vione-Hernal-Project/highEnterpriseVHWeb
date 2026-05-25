"use client";

import { useEffect } from "react";

const MOTION_PANEL_SELECTOR = ".vh-men-editorial__panel--city, .vh-men-editorial__panel--portrait";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export function MenEditorialOverlayMotion() {
  useEffect(() => {
    const motionItems = Array.from(document.querySelectorAll<HTMLElement>(MOTION_PANEL_SELECTOR))
      .map((panel) => ({
        panel,
        overlay: panel.querySelector<HTMLElement>(".vh-men-editorial__overlay"),
      }))
      .filter((item): item is { panel: HTMLElement; overlay: HTMLElement } => item.overlay !== null);

    if (motionItems.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frame = 0;
    motionItems.forEach(({ panel }) => panel.classList.add("vh-men-editorial__panel--motion"));

    const update = () => {
      const viewportHeight = window.innerHeight || 1;
      const lowOffset = clamp(window.innerWidth * 0.042, 20, 66);

      motionItems.forEach(({ panel, overlay }) => {
        const panelRect = panel.getBoundingClientRect();
        const panelHeight = panelRect.height;
        const overlayHeight = overlay.offsetHeight;

        if (panelHeight <= 0 || overlayHeight <= 0) {
          return;
        }

        const coverProgress = clamp((viewportHeight - panelRect.top) / (viewportHeight + panelHeight), 0, 1);
        const progress = clamp((coverProgress - 0.44) / (0.76 - 0.44), 0, 1);

        const fixedTop = panelHeight * 0.58;
        const lowestTop = panelHeight - lowOffset - overlayHeight / 2;
        const top = clamp(fixedTop, overlayHeight / 2 + 8, panelHeight - overlayHeight / 2 - 8);
        const maxTravel = Math.max(lowestTop - top, 0);
        const travel = mix(0, maxTravel, progress);

        overlay.style.setProperty("--vh-men-overlay-top", `${top}px`);
        overlay.style.setProperty("--vh-men-overlay-travel", `${travel}px`);
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

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      motionItems.forEach(({ panel, overlay }) => {
        panel.classList.remove("vh-men-editorial__panel--motion");
        overlay.style.removeProperty("--vh-men-overlay-top");
        overlay.style.removeProperty("--vh-men-overlay-travel");
      });
    };
  }, []);

  return null;
}
