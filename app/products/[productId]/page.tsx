import { redirect } from "next/navigation";

type Props = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function LegacyProductPage({ params }: Props) {
  const { productId } = await params;
  redirect(`/product/${encodeURIComponent(productId)}`);
}
