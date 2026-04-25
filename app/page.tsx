import type { Metadata } from "next";

import { LandingPage } from "@/components/home/landing-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Blockchain Fashion And Minimal Luxury",
  description:
    "Vione Hernal presents blockchain fashion, minimal luxury fashion, and designer streetwear from the Philippines.",
  path: "/",
  image: "/assets/images/model-4.jpg",
});

export default function HomePage() {
  return <LandingPage />;
}
