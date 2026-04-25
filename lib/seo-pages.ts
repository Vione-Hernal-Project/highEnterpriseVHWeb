export type SeoLandingPageConfig = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  productCategory?: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  links: Array<{ label: string; href: string }>;
};

export const seoLandingPages: SeoLandingPageConfig[] = [
  {
    path: "/blockchain-fashion",
    eyebrow: "Blockchain Fashion",
    title: "Blockchain Fashion",
    description: "Minimal luxury fashion shaped for verifiable ownership, provenance, and modern digital identity.",
    sections: [
      {
        heading: "Luxury With A Verifiable Record",
        body: "Blockchain fashion gives each piece a stronger ownership story without changing the quiet discipline of the garment itself.",
      },
      {
        heading: "Designed For Trust",
        body: "Vione Hernal uses web3 infrastructure as a foundation for authenticity, resale clarity, and long-term customer confidence.",
      },
    ],
    links: [
      { label: "Web3 Fashion", href: "/web3-fashion" },
      { label: "What Is Blockchain Fashion", href: "/editorial/what-is-blockchain-fashion" },
      { label: "Shop", href: "/shop" },
    ],
  },
  {
    path: "/luxury-streetwear",
    eyebrow: "Luxury Streetwear",
    title: "Luxury Streetwear",
    description: "Designer streetwear with a refined silhouette, elevated restraint, and a Philippine luxury point of view.",
    sections: [
      {
        heading: "Streetwear With Restraint",
        body: "Luxury streetwear at Vione Hernal favors controlled proportions, tactile finish, and pieces that carry presence without excess.",
      },
      {
        heading: "A Modern Wardrobe Language",
        body: "The collection is built to move between editorial dressing, daily wear, and blockchain-enabled ownership.",
      },
    ],
    links: [
      { label: "Designer Streetwear Philippines", href: "/designer-streetwear-philippines" },
      { label: "Minimal Luxury Fashion", href: "/minimal-luxury-fashion" },
      { label: "New Arrivals", href: "/new" },
    ],
  },
  {
    path: "/minimal-luxury-fashion",
    eyebrow: "Minimal Luxury Fashion",
    title: "Minimal Luxury Fashion",
    description: "A focused edit of refined forms, quiet confidence, and modern luxury essentials by Vione Hernal.",
    sections: [
      {
        heading: "Quiet Form, Strong Presence",
        body: "Minimal luxury fashion is not absence. It is precision, edited shape, and the ability for a piece to hold attention calmly.",
      },
      {
        heading: "Built Around Intention",
        body: "Vione Hernal pieces are styled for repeat wear, polished contrast, and a wardrobe that feels deliberate.",
      },
    ],
    links: [
      { label: "Minimal Luxury Wardrobe Guide", href: "/editorial/minimal-luxury-wardrobe-guide" },
      { label: "Women", href: "/women" },
      { label: "Shop", href: "/shop" },
    ],
  },
  {
    path: "/web3-fashion",
    eyebrow: "Web3 Fashion",
    title: "Web3 Fashion",
    description: "A premium approach to web3 fashion where digital ownership supports physical luxury design.",
    sections: [
      {
        heading: "Digital Ownership, Physical Luxury",
        body: "Web3 fashion connects the wardrobe to a digital layer of authenticity, ownership, and future collectability.",
      },
      {
        heading: "Technology In Service Of Design",
        body: "The Vione Hernal approach keeps the visual language minimal while making the ownership experience more durable.",
      },
    ],
    links: [
      { label: "Future Of Fashion Ownership", href: "/editorial/future-of-fashion-ownership" },
      { label: "Blockchain Fashion", href: "/blockchain-fashion" },
      { label: "Shop", href: "/shop" },
    ],
  },
  {
    path: "/designer-streetwear-philippines",
    eyebrow: "Designer Streetwear Philippines",
    title: "Designer Streetwear Philippines",
    description: "Vione Hernal presents designer streetwear from the Philippines through minimal luxury and blockchain-ready ownership.",
    sections: [
      {
        heading: "A Philippine Luxury Perspective",
        body: "Vione Hernal brings a Philippine point of view to designer streetwear through edited silhouettes and a precise brand language.",
      },
      {
        heading: "Global Form, Local Direction",
        body: "The collection is built for customers searching for modern luxury fashion with a sharper ownership experience.",
      },
    ],
    links: [
      { label: "Luxury Streetwear", href: "/luxury-streetwear" },
      { label: "Women", href: "/women" },
      { label: "Editorial", href: "/editorial" },
    ],
  },
];

export function getSeoLandingPage(path: string) {
  return seoLandingPages.find((page) => page.path === path) ?? null;
}
