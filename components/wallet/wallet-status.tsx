"use client";

import { VHL_TOKEN_SYMBOL } from "@/lib/web3/config";
import { formatVhlBalance } from "@/lib/web3/metamask";
import { useVhlWallet } from "@/lib/web3/use-vhl-wallet";
import { formatWalletAddress } from "@/lib/utils";
import { ETHEREUM_MAINNET_NETWORK_NAME } from "@/lib/web3/network";

export function WalletStatus() {
  const {
    account,
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

  const connectedLabel = account
    ? `${formatWalletAddress(account)} · ${
        isSupportedChain
          ? vhlBalance !== null
            ? `${formatVhlBalance(vhlBalance)} ${VHL_TOKEN_SYMBOL}`
            : `${ETHEREUM_MAINNET_NETWORK_NAME} connected`
          : `${ETHEREUM_MAINNET_NETWORK_NAME} required`
      }`
    : "";

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
      ) : (
        <button type="button" className="vh-wallet-pill vh-wallet-pill--button" disabled={isConnecting} onClick={connectWallet}>
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {account && !isSupportedChain ? (
        <span className="vh-wallet-note vh-wallet-note--error">Please switch MetaMask to Ethereum Mainnet.</span>
      ) : null}

      {!account && !error ? (
        <span className="vh-wallet-note">
          {hasProvider ? ETHEREUM_MAINNET_NETWORK_NAME : "MetaMask required"}
          {isLoading ? " · checking wallet" : ""}
        </span>
      ) : null}

      {notice ? <span className="vh-wallet-note">{notice}</span> : null}
      {error ? <span className="vh-wallet-note vh-wallet-note--error">{error}</span> : null}

      {!account && showInstallFallback ? (
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
