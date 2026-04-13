import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { HeaderStoreLinks } from "@/components/storefront/header-store-links";
import { WalletStatus } from "@/components/wallet/wallet-status";

type Props = {
  signedIn: boolean;
  isManagementUser: boolean;
};

export function SiteHeader({ signedIn, isManagementUser }: Props) {
  return (
    <header className="global-header">
      <nav className="global-header__tertiary-nav" aria-label="Tertiary">
        <a href="#page-content" className="btn btn--xs skip-link js-focus-to u-capitalize">
          Skip To Main Content
        </a>
        <a href="#global-site__footer" className="btn btn--xs skip-link js-focus-to u-capitalize">
          Skip To Footer
        </a>
        <div className="container">
          <ul className="global-header__tertiary-nav-list">
            <li className="global-header__tertiary-nav-list-item u-margin-r--xxl">
              Philippines | EN | USD
            </li>
            <li className="global-header__tertiary-nav-list-item u-margin-r--xxl">
              <a href="mailto:service@vionehernal.com">Need Help?</a>
            </li>
            <li className="global-header__tertiary-nav-list-item u-margin-r--xxl">
              <WalletStatus />
            </li>
            {signedIn ? (
              <li className="global-header__tertiary-nav-list-item">
                <div className="vh-header-auth-links">
                  <Link className="vh-auth-link" href="/dashboard">
                    Account
                  </Link>
                  <LogoutButton redirectTo="/" variant="link">
                    Log Out
                  </LogoutButton>
                </div>
              </li>
            ) : (
              <li className="global-header__tertiary-nav-list-item">
                <Link className="vh-auth-link" href="/sign-in">
                  Sign In
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div className="container">
        <div className="global-header__wrap">
          <Link
            className="global-header__brand-logo"
            href="/"
            aria-label="Vione Hernal home"
            style={{ position: "relative", zIndex: 4, pointerEvents: "auto" }}
          >
            <span style={{ fontSize: "12px", letterSpacing: "0.42em", textTransform: "uppercase", fontWeight: 700 }}>
              Vione Hernal
            </span>
          </Link>

          <nav className="global-header__secondary-nav" aria-label="Secondary">
            <ul className="global-header__secondary-nav-list">
              <li className="global-header__secondary-nav-list-item u-margin-r--xxl">
                <Link href="/">Womens</Link>
              </li>
              <HeaderStoreLinks />
              <li className="global-header__secondary-nav-list-item global-header__secondary-responsive-margin">
                <Link href="/dashboard">Dashboard</Link>
              </li>
              {isManagementUser ? (
                <li className="global-header__secondary-nav-list-item global-header__secondary-responsive-margin">
                  <Link href="/admin/ledger">Ledger</Link>
                </li>
              ) : null}
              {isManagementUser ? (
                <li className="global-header__secondary-nav-list-item">
                  <Link href="/admin">Admin</Link>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>

        <nav className="nav-primary" aria-label="Primary">
          <ul className="nav-primary__list u-static">
            <li className="nav-primary__item first">
              <Link className="nav-primary__link" href="/">
                new
              </Link>
            </li>
            <li className="nav-primary__item first">
              <Link className="nav-primary__link" href="/about">
                about
              </Link>
            </li>
            <li className="nav-primary__item first">
              <Link className="nav-primary__link" href="/affiliate">
                affiliate
              </Link>
            </li>
            <li className="nav-primary__item first">
              <Link className="nav-primary__link" href="/coming-soon?feature=customer-care">
                customer care
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
