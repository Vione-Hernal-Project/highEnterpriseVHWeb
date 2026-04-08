import { formatPhpCurrencyFromCents } from "@/lib/payments/amounts";

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  description: string;
  pricePhpCents: number;
  image: string;
  hoverImage: string;
};

export const featuredProducts: CatalogProduct[] = [
  {
    id: "MIUF-WZ238",
    name: "Maison Mary Jane Flat",
    brand: "VIONE HERNAL",
    description: "Glossed leather lines with an editorial finish for day-to-night dressing.",
    pricePhpCents: 50000,
    image: "/assets/images/maryjaneshoe.png",
    hoverImage: "/assets/images/maryjaneshoe.png",
  },
  {
    id: "BOFE-WS139",
    name: "Sheer Layered Co-Ord Set",
    brand: "VIONE HERNAL",
    description: "Layered tailoring with a softened structure that keeps the silhouette refined.",
    pricePhpCents: 150000,
    image: "/assets/images/SheerLayeredCo-OrdSet-1.png",
    hoverImage: "/assets/images/SheerLayeredCo-OrdSet.png",
  },
  {
    id: "BOFE-WY20",
    name: "Rose Tweed Top Handle Bag",
    brand: "VIONE HERNAL",
    description: "A statement carryall shaped with couture texture and a polished top-handle profile.",
    pricePhpCents: 200000,
    image: "/assets/images/RoseTweedTopHandleBag.png",
    hoverImage: "/assets/images/RoseTweedTopHandleBag-1.png",
  },
];

export function getCatalogProduct(productId: string | null | undefined) {
  if (!productId) {
    return featuredProducts[0] ?? null;
  }

  return featuredProducts.find((product) => product.id === productId) ?? featuredProducts[0] ?? null;
}

export function getCatalogSubtotalPhpCents(pricePhpCents: number, quantity: number) {
  return pricePhpCents * quantity;
}

export function getCatalogPriceLabel(pricePhpCents: number) {
  return formatPhpCurrencyFromCents(pricePhpCents);
}
