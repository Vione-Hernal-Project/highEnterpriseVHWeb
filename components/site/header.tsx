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
    <header className="global-header vh-site-header">
      <nav className="global-header__tertiary-nav vh-header-utility" aria-label="Tertiary">
        <a href="#page-content" className="btn btn--xs skip-link js-focus-to u-capitalize">
          Skip To Main Content
        </a>
        <a href="#global-site__footer" className="btn btn--xs skip-link js-focus-to u-capitalize">
          Skip To Footer
        </a>
        <div className="container vh-header-utility__inner">
          <div className="vh-header-utility__bar">
            <ul className="global-header__tertiary-nav-list vh-header-utility__list">
              <li className="global-header__tertiary-nav-list-item">
                Philippines | EN | USD
              </li>
              <li className="global-header__tertiary-nav-list-item">
                <a href="mailto:vionehernal@gmail.com">Need Help?</a>
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
            <div className="vh-header-utility__wallet">
              <WalletStatus />
            </div>
          </div>
        </div>
      </nav>

      <div className="container vh-header-shell">
        <div className="global-header__wrap vh-header-balance">
          <nav className="global-header__secondary-nav vh-header-balance__nav vh-header-balance__nav--left" aria-label="Store">
            <ul className="global-header__secondary-nav-list vh-header-balance__list vh-header-balance__list--left">
              <li className="global-header__secondary-nav-list-item global-header__secondary-responsive-margin">
                <Link href="/shop">Womens</Link>
              </li>
              <li className="global-header__secondary-nav-list-item global-header__secondary-responsive-margin">
                <Link href="/dashboard">Dashboard</Link>
              </li>
            </ul>
          </nav>

          <Link
            className="vh-header-balance__brand"
            href="/"
            aria-label="Vione Hernal home"
            style={{ zIndex: 4, pointerEvents: "auto" }}
          >
            <span className="vh-header-balance__wordmark">Vione Hernal</span>
          </Link>

          <nav className="global-header__secondary-nav vh-header-balance__nav vh-header-balance__nav--right" aria-label="Shopping">
            <ul className="global-header__secondary-nav-list vh-header-balance__list vh-header-balance__list--right">
              <HeaderStoreLinks />
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

        <nav className="nav-primary vh-header-primary" aria-label="Primary">
          <ul className="nav-primary__list u-static vh-header-primary__list">
            <li className="nav-primary__item first">
              <Link className="nav-primary__link" href="/new">
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
