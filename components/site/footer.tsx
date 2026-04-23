import Link from "next/link";

type Props = {
  signedIn?: boolean;
};

export function SiteFooter({ signedIn = false }: Props) {
  return (
    <footer className="site-footer site-footer--t-margin vh-site-footer">
      <div className="vh-footer-survey" aria-label="Survey banner">
        <div className="container vh-footer-survey__inner">
          <p className="vh-footer-survey__headline">Help Us Improve</p>
          <p className="vh-footer-survey__copy">Take a brief survey about today&apos;s visit</p>
          <Link className="vh-footer-survey__link" href="/coming-soon?feature=survey">
            Begin Survey
          </Link>
        </div>
      </div>

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
              <div className="vh-footer-access">
                <div role="heading" aria-level={2} className="h5 u-margin-t--none u-margin-b--sm">
                  Private Access
                </div>
                <p className="vh-footer-access__copy">
                  Receive select updates on new arrivals and curated releases.
                  <br />
                  Unsubscribe at any time.
                </p>
                <div className="vh-footer-access__field" role="group" aria-label="Private access email entry">
                  <label className="u-screen-reader" htmlFor="footer-private-access-email">
                    Enter your email
                  </label>
                  <input
                    id="footer-private-access-email"
                    className="vh-footer-access__input"
                    type="email"
                    placeholder="Enter your email"
                  />
                  <button className="vh-footer-access__button" type="button" aria-label="Enter your email">
                    <span aria-hidden="true">&rsaquo;</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid__col n-4-of-12">
              <div className="vh-footer-contact">
                <div role="heading" aria-level={2} className="h5 u-margin-t--none u-margin-b--sm">
                  Contact
                </div>
                <ul className="ui-list">
                  <li className="ui-list__item">
                    <a href="mailto:vionehernal@gmail.com">vionehernal@gmail.com</a>
                  </li>
                  <li className="ui-list__item">
                    <a href="https://t.me/nothingisloud">
                      Telegram <br />
                      @nothingisloud
                    </a>
                  </li>
                  <li className="ui-list__item">
                    <Link href="/coming-soon?feature=instagram">Instagram</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
