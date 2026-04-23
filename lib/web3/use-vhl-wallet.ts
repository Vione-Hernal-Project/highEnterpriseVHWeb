"use client";

import { useEffect, useState } from "react";

import { connectWallet, getInjectedEthereum, getWalletSnapshot } from "@/lib/web3/metamask";

type WalletState = {
  account: string | null;
  chainId: number | null;
  isSupportedChain: boolean;
  vhlBalance: string | null;
  hasProvider: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  error: string;
};

const initialState: WalletState = {
  account: null,
  chainId: null,
  isSupportedChain: false,
  vhlBalance: null,
  hasProvider: false,
  isConnecting: false,
  isLoading: true,
  error: "",
};

export function useVhlWallet() {
  const [state, setState] = useState<WalletState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function syncWallet() {
      const snapshot = await getWalletSnapshot();

      if (cancelled) {
        return;
      }

      setState((previous) => ({
        ...previous,
        ...snapshot,
        isLoading: false,
        error: previous.error && snapshot.account ? "" : previous.error,
      }));
    }

    setState((previous) => ({
      ...previous,
      hasProvider: Boolean(getInjectedEthereum()),
      isLoading: true,
    }));

    void syncWallet();

    const ethereum = getInjectedEthereum();

    if (!ethereum?.on) {
      return () => {
        cancelled = true;
      };
    }

    const handleWalletUpdate = () => {
      void syncWallet();
    };

    ethereum.on("accountsChanged", handleWalletUpdate);
    ethereum.on("chainChanged", handleWalletUpdate);

    return () => {
      cancelled = true;

      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleWalletUpdate);
        ethereum.removeListener("chainChanged", handleWalletUpdate);
      }
    };
  }, []);

  async function handleConnectWallet() {
    setState((previous) => ({
      ...previous,
      hasProvider: Boolean(getInjectedEthereum()),
      isConnecting: true,
      error: "",
    }));

    try {
      const account = await connectWallet();

      if (!account) {
        throw new Error("No wallet account was returned.");
      }

      const snapshot = await getWalletSnapshot();

      setState({
        ...initialState,
        ...snapshot,
        isConnecting: false,
        isLoading: false,
      });
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 4001
          ? "Wallet connection was cancelled."
          : error instanceof Error
            ? error.message
            : "Unable to connect MetaMask right now.";

      setState((previous) => ({
        ...previous,
        hasProvider: Boolean(getInjectedEthereum()),
        isConnecting: false,
        isLoading: false,
        error: message,
      }));
    }
  }

  return {
    ...state,
    isConnected: Boolean(state.account),
    connectWallet: handleConnectWallet,
  };
}
