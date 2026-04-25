export type EditorialArticle = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  publishedAt: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
  productLinks: string[];
  relatedLinks: Array<{ label: string; href: string }>;
};

export const editorialArticles: EditorialArticle[] = [
  {
    slug: "what-is-blockchain-fashion",
    title: "What Is Blockchain Fashion?",
    description:
      "A clear guide to blockchain fashion, digital ownership, and how Vione Hernal approaches authenticity without compromising luxury.",
    eyebrow: "Blockchain Fashion",
    publishedAt: "2026-04-26T00:00:00.000Z",
    productLinks: ["BOFE-WS139", "BOFE-WY20"],
    relatedLinks: [
      { label: "Blockchain Fashion", href: "/blockchain-fashion" },
      { label: "Web3 Fashion", href: "/web3-fashion" },
      { label: "Shop the Collection", href: "/shop" },
    ],
    sections: [
      {
        heading: "Fashion With Verifiable Ownership",
        body: [
          "Blockchain fashion connects a physical piece with a digital record of authenticity, provenance, and ownership.",
          "For Vione Hernal, the technology is quiet infrastructure. It supports trust while the garment remains the center of the experience.",
        ],
      },
      {
        heading: "Why It Matters For Luxury",
        body: [
          "Luxury depends on confidence. A blockchain-backed record can help protect provenance, resale clarity, and customer trust.",
          "The result is not louder fashion, but a more intentional relationship between the wearer and the piece.",
        ],
      },
    ],
  },
  {
    slug: "future-of-fashion-ownership",
    title: "The Future Of Fashion Ownership",
    description:
      "How digital identity, verifiable ownership, and luxury streetwear can reshape the way fashion is collected and valued.",
    eyebrow: "Web3 Fashion",
    publishedAt: "2026-04-26T00:00:00.000Z",
    productLinks: ["BOFE-WY20", "MIUF-WZ238"],
    relatedLinks: [
      { label: "Web3 Fashion", href: "/web3-fashion" },
      { label: "Luxury Streetwear", href: "/luxury-streetwear" },
      { label: "Bags", href: "/bags" },
    ],
    sections: [
      {
        heading: "From Purchase To Provenance",
        body: [
          "The next era of fashion ownership is built around continuity: what a piece is, where it came from, and how it remains connected to the owner.",
          "Digital ownership records can extend the life of a luxury piece beyond the original transaction.",
        ],
      },
      {
        heading: "A More Permanent Wardrobe",
        body: [
          "Vione Hernal treats ownership as part of design. The garment, its identity, and its record should feel considered from the beginning.",
        ],
      },
    ],
  },
  {
    slug: "minimal-luxury-wardrobe-guide",
    title: "Minimal Luxury Wardrobe Guide",
    description:
      "A Vione Hernal guide to building a minimal luxury wardrobe through refined silhouettes, restraint, and designer streetwear essentials.",
    eyebrow: "Minimal Luxury Fashion",
    publishedAt: "2026-04-26T00:00:00.000Z",
    productLinks: ["BOFE-WS139", "MIUF-WZ238"],
    relatedLinks: [
      { label: "Minimal Luxury Fashion", href: "/minimal-luxury-fashion" },
      { label: "Women", href: "/women" },
      { label: "New Arrivals", href: "/new" },
    ],
    sections: [
      {
        heading: "Begin With Shape",
        body: [
          "A minimal luxury wardrobe starts with silhouette. Clean proportion, precise structure, and strong materials do more than decoration.",
          "The goal is not less expression, but a more disciplined form of presence.",
        ],
      },
      {
        heading: "Choose Pieces That Hold",
        body: [
          "Designer streetwear becomes lasting when it is edited, tactile, and easy to return to. Vione Hernal pieces are designed for that kind of repetition.",
        ],
      },
    ],
  },
];

export function getEditorialArticle(slug: string) {
  return editorialArticles.find((article) => article.slug === slug) ?? null;
}
