"use client";

import { useEffect, useState } from "react";

import { VHL_TOKEN_SYMBOL } from "@/lib/web3/config";
import { formatVhlBalance } from "@/lib/web3/metamask";
import { useVhlWallet } from "@/lib/web3/use-vhl-wallet";
import { formatWalletAddress } from "@/lib/utils";
import { ETHEREUM_MAINNET_NETWORK_NAME } from "@/lib/web3/network";
import {
  connectSolanaWallet,
  disconnectSolanaWallet,
  getInjectedSolanaProvider,
  getPhantomMobileBrowseUrl,
  getPhantomInstallUrl,
  hasPhantomWallet,
  isSolanaMobileBrowser,
  openPhantomMobileDeepLink,
} from "@/lib/solana/payments";

const SOLANA_CONNECT_TIMEOUT_MS = 8_000;
const SOLANA_DISCONNECT_OVERRIDE_KEY = "vh.solana.disconnectOverride";

function readSolanaDisconnectOverride() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(SOLANA_DISCONNECT_OVERRIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSolanaDisconnectOverride(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(SOLANA_DISCONNECT_OVERRIDE_KEY, "1");
    } else {
      window.localStorage.removeItem(SOLANA_DISCONNECT_OVERRIDE_KEY);
    }
  } catch {
    // Keep the wallet UI usable in browsers that restrict storage access.
  }
}

function MetaMaskLogo() {
  return (
    <svg className="vh-wallet-choice__logo-svg" viewBox="0 0 318.6 318.6" aria-hidden="true" focusable="false">
      <path fill="#e2761b" stroke="#e2761b" strokeLinecap="round" strokeLinejoin="round" d="m274.1 35.5-99.5 73.9L193 65.8z" />
      <path fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round" d="m44.4 35.5 98.7 74.6-17.5-44.3zm193.9 171.3-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" />
      <path fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2-15.8 23.9 56.3 2.5-2-60.5zm111.3 0-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5 33.9 16.5-4.7-39.3z" />
      <path fill="#d7c1b3" stroke="#d7c1b3" strokeLinecap="round" strokeLinejoin="round" d="m211.8 247.4-33.9-16.5 2.7 22.1-.3 9.3zm-105 0 31.5 14.9-.2-9.3 2.5-22.1z" />
      <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="m138.8 193.5-28.2-8.3 19.9-9.1zm40.9 0 8.3-17.4 20 9.1z" />
      <path fill="#cd6116" stroke="#cd6116" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7zm23.8-44.7-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zm-120.2 23.1 20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z" />
      <path fill="#e4751f" stroke="#e4751f" strokeLinecap="round" strokeLinejoin="round" d="m87.8 162.1 23.6 46-.8-22.9zm120.3 23.1-1 22.9 23.7-46zm-64-20.6-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0-2.7 18 1.2 45 6.7-34.1z" />
      <path fill="#f6851b" stroke="#f6851b" strokeLinecap="round" strokeLinejoin="round" d="m179.8 193.5-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69.2-8.3.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z" />
      <path fill="#c0ad9e" stroke="#c0ad9e" strokeLinecap="round" strokeLinejoin="round" d="m180.3 262.3.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z" />
      <path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="m177.9 230.9-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z" />
      <path fill="#763d16" stroke="#763d16" strokeLinecap="round" strokeLinejoin="round" d="m278.3 114.2 8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z" />
      <path fill="#f6851b" stroke="#f6851b" strokeLinecap="round" strokeLinejoin="round" d="m267.2 153.5-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4 3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" />
    </svg>
  );
}

export function WalletStatus() {
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [solanaAccount, setSolanaAccount] = useState<string | null>(null);
  const [isSolanaConnecting, setIsSolanaConnecting] = useState(false);
  const [solanaError, setSolanaError] = useState("");
  const [solanaNotice, setSolanaNotice] = useState("");
  const {
    account,
    chainId,
    disconnectWallet,
    error,
    hasProvider,
    installTarget,
    isConnecting,
    isDisconnecting,
    isLoading,
    isSupportedChain,
    mobileInstallUrl,
    notice,
    showInstallFallback,
    vhlBalance,
    connectWallet,
  } = useVhlWallet();

  useEffect(() => {
    const provider = getInjectedSolanaProvider();

    if (!provider) {
      return;
    }

    const syncAccount = (nextPublicKey?: unknown) => {
      if (nextPublicKey === null) {
        writeSolanaDisconnectOverride(true);
        setSolanaAccount(null);
        return;
      }

      if (readSolanaDisconnectOverride()) {
        setSolanaAccount(null);
        return;
      }

      const publicKey =
        nextPublicKey && typeof nextPublicKey === "object" && "toString" in nextPublicKey
          ? (nextPublicKey as { toString: () => string }).toString()
          : provider.publicKey?.toString?.() || provider.publicKey?.toBase58?.();

      setSolanaAccount(publicKey || null);
    };
    const handleDisconnect = () => {
      writeSolanaDisconnectOverride(true);
      setSolanaAccount(null);
    };

    syncAccount();
    provider.on?.("connect", syncAccount);
    provider.on?.("accountChanged", syncAccount);
    provider.on?.("disconnect", handleDisconnect);

    return () => {
      provider.removeListener?.("connect", syncAccount);
      provider.removeListener?.("accountChanged", syncAccount);
      provider.removeListener?.("disconnect", handleDisconnect);
    };
  }, []);

  const connectedLabel = account
    ? `${formatWalletAddress(account)} · ${
        isSupportedChain
          ? vhlBalance !== null
            ? `${formatVhlBalance(vhlBalance)} ${VHL_TOKEN_SYMBOL}`
            : `${ETHEREUM_MAINNET_NETWORK_NAME} connected`
          : chainId === null
            ? "Checking network"
            : `${ETHEREUM_MAINNET_NETWORK_NAME} required`
      }`
    : "";
  const solanaConnectedLabel = solanaAccount ? `${formatWalletAddress(solanaAccount)} · Phantom connected` : "";
  const isAnyConnecting = isConnecting || isSolanaConnecting;

  function withSolanaConnectTimeout<T>(promise: Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Phantom wallet is taking too long to respond. Unlock Phantom, then try again."));
      }, SOLANA_CONNECT_TIMEOUT_MS);

      promise.then(
        (value) => {
          window.clearTimeout(timeoutId);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
      );
    });
  }

  async function handlePhantomConnect() {
    setIsSolanaConnecting(true);
    setSolanaError("");
    setSolanaNotice("Opening Phantom...");

    try {
      if (!hasPhantomWallet() && isSolanaMobileBrowser()) {
        writeSolanaDisconnectOverride(false);
        openPhantomMobileDeepLink();
        setIsChooserOpen(false);
        setSolanaNotice("Opening Phantom mobile. Return here from Phantom to connect.");
        return;
      }

      const wallet = await withSolanaConnectTimeout(connectSolanaWallet({ forcePrompt: true }));

      writeSolanaDisconnectOverride(false);
      setSolanaAccount(wallet.walletAddress);
      setIsChooserOpen(false);
      setSolanaNotice("Phantom wallet connected.");
    } catch (error) {
      setSolanaNotice("");
      setSolanaError(error instanceof Error ? error.message : "Unable to connect a Solana wallet right now.");
    } finally {
      setIsSolanaConnecting(false);
    }
  }

  async function handleSolanaDisconnect() {
    setIsSolanaConnecting(true);
    setSolanaError("");

    try {
      writeSolanaDisconnectOverride(true);
      await disconnectSolanaWallet();
      setSolanaAccount(null);
      setSolanaNotice("Solana wallet disconnected on this device.");
    } catch (error) {
      setSolanaError(error instanceof Error ? error.message : "Unable to disconnect the Solana wallet right now.");
    } finally {
      setIsSolanaConnecting(false);
    }
  }

  return (
    <div className="vh-wallet-status" aria-live="polite">
      {account ? (
        <>
          <span className="vh-wallet-pill">{connectedLabel}</span>
          <div className="vh-wallet-actions">
            <button type="button" className="vh-wallet-action" disabled={isDisconnecting} onClick={disconnectWallet}>
              {isDisconnecting ? "Disconnecting..." : "Disconnect Wallet"}
            </button>
          </div>
        </>
      ) : solanaAccount ? (
        <>
          <span className="vh-wallet-pill">{solanaConnectedLabel}</span>
          <div className="vh-wallet-actions">
            <button type="button" className="vh-wallet-action" disabled={isSolanaConnecting} onClick={handleSolanaDisconnect}>
              {isSolanaConnecting ? "Disconnecting..." : "Disconnect Wallet"}
            </button>
          </div>
        </>
      ) : (
        <div className="vh-wallet-connect-menu">
          <button
            type="button"
            className="vh-wallet-pill vh-wallet-pill--button"
            disabled={isAnyConnecting}
            onClick={() => {
              if (!isAnyConnecting) {
                setIsChooserOpen((current) => !current);
              }
            }}
            aria-expanded={isChooserOpen}
          >
            {isAnyConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          {isChooserOpen ? (
            <div className="vh-wallet-choice-panel" role="dialog" aria-modal="false" aria-label="Connect wallet">
              <div className="vh-wallet-choice-panel__header">
                <span className="vh-wallet-choice-panel__title">Connect</span>
                <button type="button" className="vh-wallet-choice-panel__close" onClick={() => setIsChooserOpen(false)} aria-label="Close wallet options">
                  x
                </button>
              </div>
              <button
                type="button"
                className="vh-wallet-choice vh-wallet-choice--metamask"
                disabled={isAnyConnecting}
                onClick={async () => {
                  setIsChooserOpen(false);
                  await connectWallet();
                }}
              >
                <span className="vh-wallet-choice__logo vh-wallet-choice__logo--metamask">
                  <MetaMaskLogo />
                </span>
                <span className="vh-wallet-choice__text">
                  <span className="vh-wallet-choice__network">Ethereum</span>
                  <span className="vh-wallet-choice__wallet">MetaMask</span>
                  <span className="vh-wallet-choice__note">Connect for Ethereum Mainnet payments.</span>
                </span>
              </button>
              <button type="button" className="vh-wallet-choice vh-wallet-choice--phantom" disabled={isAnyConnecting} onClick={handlePhantomConnect}>
                {!hasPhantomWallet() ? <span className="vh-wallet-choice__badge vh-wallet-choice__badge--right">Install</span> : null}
                <span className="vh-wallet-choice__logo vh-wallet-choice__logo--phantom">
                  <img className="vh-wallet-choice__logo-img" src="/assets/images/phantom-logo.svg" alt="" aria-hidden="true" />
                </span>
                <span className="vh-wallet-choice__text">
                  <span className="vh-wallet-choice__network">Solana</span>
                  <span className="vh-wallet-choice__wallet">Phantom Wallet</span>
                  <span className="vh-wallet-choice__note">Open the Phantom extension for Solana payments.</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      )}

      {account && !isSupportedChain ? (
        <span className="vh-wallet-note vh-wallet-note--error">Please switch MetaMask to Ethereum Mainnet.</span>
      ) : null}

      {!account && !error ? (
        <span className="vh-wallet-note">
          {solanaAccount ? "Solana Mainnet" : hasProvider ? "Wallet options available" : "Choose Ethereum or Solana"}
          {isLoading ? " · checking wallet" : ""}
        </span>
      ) : null}

      {notice ? <span className="vh-wallet-note">{notice}</span> : null}
      {solanaNotice && !notice ? <span className="vh-wallet-note">{solanaNotice}</span> : null}
      {error ? <span className="vh-wallet-note vh-wallet-note--error">{error}</span> : null}
      {solanaError ? <span className="vh-wallet-note vh-wallet-note--error">{solanaError}</span> : null}

      {solanaError && solanaError.toLowerCase().includes("phantom") ? (
        <a className="vh-wallet-note vh-wallet-note--link" href={getPhantomInstallUrl()} target="_blank" rel="noreferrer">
          Install Phantom from the official site
        </a>
      ) : null}

      {solanaNotice.toLowerCase().includes("phantom mobile") ? (
        <a className="vh-wallet-note vh-wallet-note--link" href={getPhantomMobileBrowseUrl()} target="_blank" rel="noreferrer">
          Open Phantom mobile link
        </a>
      ) : null}

      {!account && error && showInstallFallback ? (
        <div className="vh-wallet-fallback">
          <div className="vh-wallet-fallback__header">
            <span className="vh-wallet-fallback__eyebrow">Install MetaMask</span>
          </div>
          <p className="vh-wallet-fallback__copy">
            Install MetaMask from the official source only. Never download wallet apps from unofficial links.
          </p>
          <a className="vh-wallet-fallback__button" href={installTarget.href} target="_blank" rel="noreferrer">
            {installTarget.label}
          </a>
          {!hasProvider && mobileInstallUrl ? (
            <a className="vh-wallet-note vh-wallet-note--link" href={mobileInstallUrl} target="_blank" rel="noreferrer">
              View official MetaMask download options
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
