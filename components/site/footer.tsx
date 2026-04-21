import Link from "next/link";

type Props = {
  signedIn?: boolean;
};

export function SiteFooter({ signedIn = false }: Props) {
  return (
    <footer className="site-footer site-footer--t-margin">
      <div className="site-footer__container" id="global-site__footer">
        <div className="container">
          <div className="grid">
            <div className="grid__col n-4-of-12">
              <div role="heading" aria-level={2} className="h5 u-margin-t--none u-margin-b--sm">
                Vione Hernal
              </div>
              <div className="grid n-block-grid--2">
                <div className="grid__col">
                  <ul className="ui-list">
                    <li className="ui-list__item">
                      <Link href="/coming-soon?feature=customer-care">Customer Care</Link>
                    </li>
                    <li className="ui-list__item">
                      <Link href="/dashboard">Track Your Order</Link>
                    </li>
                    <li className="ui-list__item">
                      <Link href="/coming-soon?feature=shipping-returns">Shipping &amp; Returns</Link>
                    </li>
                    <li className="ui-list__item">
                      <Link href="/about">About Us</Link>
                    </li>
                  </ul>
                </div>
                <div className="grid__col u-padding-l--xl">
                  <ul className="ui-list">
                    <li className="ui-list__item">
                      <Link href="/affiliate">Affiliate</Link>
                    </li>
                    <li className="ui-list__item">
                      <Link href="/bag">My Bag</Link>
                    </li>
                    <li className="ui-list__item">
                      <Link href={signedIn ? "/dashboard" : "/sign-in"}>{signedIn ? "Account" : "Sign In"}</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid__col n-4-of-12">
              <div role="heading" aria-level={2} className="h5 u-margin-t--none u-margin-b--sm">
                MVP Checkout
              </div>
              <p className="u-margin-t--sm">
                This MVP proves the Vione Hernal frontend and Supabase backend are working together. Users can sign in,
                place a Sepolia order, submit token payments through MetaMask, and track the result from their
                dashboard.
              </p>
            </div>

            <div className="grid__col n-4-of-12">
              <div role="heading" aria-level={2} className="h5 u-margin-t--none u-margin-b--sm">
                Contact
              </div>
              <ul className="ui-list">
                <li className="ui-list__item">
                  <a href="mailto:vionehernal@gmail.com">vionehernal@gmail.com</a>
                </li>
                <li className="ui-list__item">
                  <a href="tel:+639356625936">+63 (935) 662-5936</a>
                </li>
                <li className="ui-list__item">
                  <Link href="/coming-soon?feature=instagram">Instagram</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
