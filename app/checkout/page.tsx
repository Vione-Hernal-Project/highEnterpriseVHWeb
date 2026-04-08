import { MockCheckoutForm } from "@/components/checkout/mock-checkout-form";
import { requireUser } from "@/lib/auth";

export default async function CheckoutPage() {
  const { user } = await requireUser();

  return (
    <section className="storefront-app-view vh-checkout-page">
      <MockCheckoutForm customerEmail={user.email ?? ""} />
    </section>
  );
}
