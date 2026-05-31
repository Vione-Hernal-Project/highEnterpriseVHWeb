import { MockCheckoutForm } from "@/components/checkout/mock-checkout-form";
import { DEFAULT_CHECKOUT_AVAILABILITY_SETTINGS } from "@/lib/checkout-availability";
import { loadFreshAdminGeneralSettings } from "@/lib/admin/settings";
import { requireUser } from "@/lib/auth";
import { loadPublishedCatalogProducts } from "@/lib/products";

export default async function CheckoutPage() {
  const checkoutSettings = await loadFreshAdminGeneralSettings().catch(() => DEFAULT_CHECKOUT_AVAILABILITY_SETTINGS);

  if ("enableStore" in checkoutSettings && !checkoutSettings.enableStore) {
    return null;
  }

  const { user } = await requireUser();
  const products = await loadPublishedCatalogProducts();

  return (
    <section className="storefront-app-view vh-checkout-page">
      <MockCheckoutForm customerEmail={user.email ?? ""} products={products} checkoutSettings={checkoutSettings} />
    </section>
  );
}
