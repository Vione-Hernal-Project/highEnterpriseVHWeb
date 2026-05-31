"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { useStorefrontSettings } from "@/components/site/storefront-settings-context";
import { getBagCount, getWishlistCount, subscribeToStorefrontState } from "@/lib/storefront/storage";

const MobileWalletStatus = dynamic(
  () => import("@/components/wallet/wallet-status").then((module) => module.WalletStatus),
  {
    ssr: false,
    loading: () => <div className="vh-mobile-header__wallet-placeholder" aria-hidden="true" />,
  },
);

type Props = {
  signedIn: boolean;
  isManagementUser: boolean;
};

type MobileAuthState = {
  signedIn: boolean;
  isManagementUser: boolean;
};

const HEADER_AUTH_STATE_EVENT = "vh:auth-state";

export function MobileHeader({ signedIn, isManagementUser }: Props) {
  const { enableWishlist } = useStorefrontSettings();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileAuthState, setMobileAuthState] = useState<MobileAuthState>({
    signedIn,
    isManagementUser,
  });
  const [bagCount, setBagCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const mobileSignedIn = mobileAuthState.signedIn;
  const mobileIsManagementUser = mobileAuthState.isManagementUser;

  useEffect(() => {
    function syncCounts() {
      setBagCount(getBagCount());
      setWishlistCount(getWishlistCount());
    }

    syncCounts();

    return subscribeToStorefrontState(syncCounts);
  }, []);

  useEffect(() => {
    setMobileAuthState({
      signedIn,
      isManagementUser,
    });
  }, [isManagementUser, signedIn]);

  useEffect(() => {
    function handleAuthStateEvent(event: Event) {
      const detail = (event as CustomEvent<Partial<MobileAuthState>>).detail;

      if (!detail || typeof detail.signedIn !== "boolean") {
        return;
      }

      const nextSignedIn = detail.signedIn;

      setMobileAuthState((currentAuthState) => ({
        signedIn: nextSignedIn,
        isManagementUser:
          typeof detail.isManagementUser === "boolean" ? detail.isManagementUser : currentAuthState.isManagementUser,
      }));
    }

    window.addEventListener(HEADER_AUTH_STATE_EVENT, handleAuthStateEvent);

    return () => {
      window.removeEventListener(HEADER_AUTH_STATE_EVENT, handleAuthStateEvent);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);

    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      setMobileAuthState((currentAuthState) => ({
        ...currentAuthState,
        signedIn: true,
      }));
    }
  }, [pathname]);

  return (
    <>
      <div className="vh-mobile-header">
        <div className="vh-mobile-header__bar">
          <button
            type="button"
            className="vh-mobile-header__toggle"
            aria-expanded={isOpen}
            aria-controls="vh-mobile-drawer"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            <span className="u-screen-reader">{isOpen ? "Close" : "Menu"}</span>
          </button>

          <Link className="vh-mobile-header__brand" href="/" aria-label="Vione Hernal home">
            <span className="vh-mobile-header__wordmark">Vione Hernal</span>
          </Link>

          <Link className="vh-mobile-header__bag" href="/bag" aria-label={`My bag with ${bagCount} item${bagCount === 1 ? "" : "s"}`}>
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="vh-mobile-header__bag-count" aria-hidden="true">
              {bagCount}
            </span>
          </Link>
        </div>

        <div className="vh-mobile-header__wallet-row">
          <div className="vh-mobile-header__wallet-shell">
            <span className="vh-mobile-header__wallet-label">Wallet</span>
            {/* Mobile-only: load the real wallet widget on the client to avoid SSR hydration drift. */}
            <MobileWalletStatus />
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`vh-mobile-drawer-backdrop ${isOpen ? "is-open" : ""}`}
        aria-label="Close navigation menu"
        onClick={() => setIsOpen(false)}
      />

      <aside
        id="vh-mobile-drawer"
        className={`vh-mobile-drawer ${isOpen ? "is-open" : ""}`}
        aria-hidden={isOpen ? "false" : "true"}
      >
        <div className="vh-mobile-drawer__header">
          <p className="vh-mobile-drawer__eyebrow">Navigation</p>
          <button
            type="button"
            className="vh-mobile-drawer__close"
            aria-label="Close navigation menu"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="vh-mobile-drawer__section vh-mobile-drawer__section--summary">
          {enableWishlist ? (
            <Link className="vh-mobile-drawer__summary-link" href="/wishlist">
              <span>Wishlist</span>
              <strong>{wishlistCount}</strong>
            </Link>
          ) : null}
          <Link className="vh-mobile-drawer__summary-link" href="/bag">
            <span>My Bag</span>
            <strong>{bagCount}</strong>
          </Link>
          <Link className="vh-mobile-drawer__summary-link" href={mobileSignedIn ? "/dashboard" : "/sign-in"}>
            <span>{mobileSignedIn ? "Account" : "Sign In"}</span>
            <strong>{mobileSignedIn ? "Open" : "Enter"}</strong>
          </Link>
        </div>

        <div className="vh-mobile-drawer__section">
          <p className="vh-mobile-drawer__label">Shop</p>
          <nav aria-label="Mobile primary navigation">
            <ul className="vh-mobile-drawer__link-list">
              <li>
                <Link href="/new">New</Link>
              </li>
              <li>
                <Link href="/">Womens</Link>
              </li>
              <li>
                <Link href="/men">Mens</Link>
              </li>
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/affiliate">Affiliate</Link>
              </li>
              <li>
                <Link href="/coming-soon?feature=customer-care">Customer Care</Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="vh-mobile-drawer__section">
          <p className="vh-mobile-drawer__label">Account</p>
          <div className="vh-mobile-drawer__account">
            <Link className="vh-button vh-button--ghost" href={mobileSignedIn ? "/dashboard" : "/sign-in"}>
              {mobileSignedIn ? "Open Account" : "Sign In"}
            </Link>
            {mobileSignedIn ? (
              <LogoutButton redirectTo="/" variant="button">
                Log Out
              </LogoutButton>
            ) : (
              <Link className="vh-button" href="/sign-up">
                Create Account
              </Link>
            )}
          </div>
          {mobileIsManagementUser ? (
            <div className="vh-mobile-drawer__management">
              <Link href="/admin">Admin Panel</Link>
              <Link href="/admin/orders">Orders</Link>
              <Link href="/admin/products">Products</Link>
              <Link href="/admin/customers">Customers</Link>
            </div>
          ) : null}
        </div>

        <div className="vh-mobile-drawer__section vh-mobile-drawer__section--meta">
          <p>Philippines | EN | USD</p>
          <a href="mailto:vionehernal@gmail.com">Need Help?</a>
        </div>
      </aside>
    </>
  );
}
