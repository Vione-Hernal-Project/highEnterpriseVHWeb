"use client";

import { useEffect, useState } from "react";

import {
  connectWallet,
  getMetaMaskMobileInstallUrl,
  getWalletSnapshot,
  hasWalletConnector,
  subscribeToWalletEvents,
} from "@/lib/web3/metamask";

type WalletState = {
  account: string | null;
  chainId: number | null;
  isSupportedChain: boolean;
  vhlBalance: string | null;
  hasProvider: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  error: string;
  mobileInstallUrl: string | null;
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
  mobileInstallUrl: null,
};

export function useVhlWallet() {
  const [state, setState] = useState<WalletState>(initialState);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function syncWallet() {
      try {
        const snapshot = await getWalletSnapshot();

        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          ...snapshot,
          isLoading: false,
          error: previous.error && snapshot.account ? "" : previous.error,
          mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          hasProvider: hasWalletConnector(),
          isLoading: false,
          error: error instanceof Error ? error.message : "Unable to check the wallet connection right now.",
          mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        }));
      }
    }

    setState((previous) => ({
      ...previous,
      hasProvider: hasWalletConnector(),
      isLoading: true,
      mobileInstallUrl: getMetaMaskMobileInstallUrl(),
    }));

    void syncWallet();

    const handleWalletUpdate = () => {
      void syncWallet();
    };

    void (async () => {
      unsubscribe = await subscribeToWalletEvents(handleWalletUpdate);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function handleConnectWallet() {
    setState((previous) => ({
      ...previous,
      hasProvider: hasWalletConnector(),
      isConnecting: true,
      error: "",
      mobileInstallUrl: getMetaMaskMobileInstallUrl(),
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
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
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
        hasProvider: hasWalletConnector(),
        isConnecting: false,
        isLoading: false,
        error: message,
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
      }));
    }
  }

  return {
    ...state,
    isConnected: Boolean(state.account),
    connectWallet: handleConnectWallet,
  };
}
