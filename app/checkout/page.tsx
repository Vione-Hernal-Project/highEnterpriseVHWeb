import { MockCheckoutForm } from "@/components/checkout/mock-checkout-form";
import { requireUser } from "@/lib/auth";
import { loadPublishedCatalogProducts } from "@/lib/products";

export default async function CheckoutPage() {
  const { user } = await requireUser();
  const products = await loadPublishedCatalogProducts();

  return (
    <section className="storefront-app-view vh-checkout-page">
      <MockCheckoutForm customerEmail={user.email ?? ""} products={products} />
    </section>
  );
}
