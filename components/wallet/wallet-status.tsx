"use client";

import { SEPOLIA_NETWORK_NAME, VHL_TOKEN_SYMBOL } from "@/lib/web3/config";
import { formatVhlBalance } from "@/lib/web3/metamask";
import { useVhlWallet } from "@/lib/web3/use-vhl-wallet";
import { formatWalletAddress } from "@/lib/utils";

export function WalletStatus() {
  const { account, error, hasProvider, isConnecting, isLoading, isSepolia, vhlBalance, connectWallet } = useVhlWallet();

  const connectedLabel = account
    ? `${formatWalletAddress(account)} · ${isSepolia ? `${formatVhlBalance(vhlBalance)} ${VHL_TOKEN_SYMBOL}` : `${SEPOLIA_NETWORK_NAME} required`}`
    : "";

  return (
    <div className="vh-wallet-status" aria-live="polite">
      {account ? (
        <span className="vh-wallet-pill">{connectedLabel}</span>
      ) : (
        <button type="button" className="vh-wallet-pill vh-wallet-pill--button" disabled={isConnecting} onClick={connectWallet}>
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {account && !isSepolia ? (
        <span className="vh-wallet-note vh-wallet-note--error">Please switch MetaMask to Sepolia.</span>
      ) : null}

      {!account && !error ? (
        <span className="vh-wallet-note">
          {hasProvider ? `${SEPOLIA_NETWORK_NAME} testnet` : "MetaMask required"}
          {isLoading ? " · checking wallet" : ""}
        </span>
      ) : null}

      {error ? <span className="vh-wallet-note vh-wallet-note--error">{error}</span> : null}
    </div>
  );
}
