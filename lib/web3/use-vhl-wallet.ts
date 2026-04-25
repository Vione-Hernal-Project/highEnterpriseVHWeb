"use client";

import { useEffect, useRef, useState } from "react";

import {
  clearPendingMetaMaskMobileConnectIntent,
  connectWallet,
  disconnectWallet,
  getMetaMaskInstallTarget,
  getMetaMaskMobileDappUrl,
  getMetaMaskMobileInstallUrl,
  getWalletSnapshot,
  hasPendingMetaMaskMobileConnectIntent,
  hasWalletConnector,
  shouldRestoreWalletSession,
  subscribeToWalletEvents,
  type MetaMaskInstallTarget,
} from "@/lib/web3/metamask";

const MOBILE_DEEPLINK_FALLBACK_DELAY_MS = 1600;

type WalletState = {
  account: string | null;
  chainId: number | null;
  isSupportedChain: boolean;
  vhlBalance: string | null;
  hasProvider: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isLoading: boolean;
  error: string;
  notice: string;
  showInstallFallback: boolean;
  installTarget: MetaMaskInstallTarget;
  mobileInstallUrl: string | null;
  mobileDappUrl: string | null;
};

const initialState: WalletState = {
  account: null,
  chainId: null,
  isSupportedChain: false,
  vhlBalance: null,
  hasProvider: false,
  isConnecting: false,
  isDisconnecting: false,
  isLoading: true,
  error: "",
  notice: "",
  showInstallFallback: false,
  installTarget: getMetaMaskInstallTarget(),
  mobileInstallUrl: null,
  mobileDappUrl: null,
};

export function useVhlWallet() {
  const [state, setState] = useState<WalletState>(initialState);
  const mobileInstallFallbackTimerRef = useRef<number | null>(null);

  function clearMobileInstallFallbackTimer() {
    if (mobileInstallFallbackTimerRef.current !== null) {
      window.clearTimeout(mobileInstallFallbackTimerRef.current);
      mobileInstallFallbackTimerRef.current = null;
    }
  }

  function scheduleMobileInstallFallback() {
    if (typeof document === "undefined") {
      return;
    }

    clearMobileInstallFallbackTimer();

    mobileInstallFallbackTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      setState((previous) => ({
        ...previous,
        isConnecting: false,
        showInstallFallback: true,
        installTarget: getMetaMaskInstallTarget(),
      }));
    }, MOBILE_DEEPLINK_FALLBACK_DELAY_MS);
  }

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function syncWallet(options?: { eager?: boolean }) {
      try {
        const snapshot = await getWalletSnapshot({
          eager: options?.eager ?? (shouldRestoreWalletSession() || hasPendingMetaMaskMobileConnectIntent()),
        });

        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          ...snapshot,
          isLoading: false,
          isDisconnecting: false,
          showInstallFallback: snapshot.account ? false : previous.showInstallFallback || !snapshot.hasProvider,
          installTarget: getMetaMaskInstallTarget(),
          error: previous.error && snapshot.account ? "" : previous.error,
          notice: snapshot.account ? "" : previous.notice,
          mobileInstallUrl: getMetaMaskMobileInstallUrl(),
          mobileDappUrl: getMetaMaskMobileDappUrl(),
        }));

        if (!snapshot.account && hasPendingMetaMaskMobileConnectIntent()) {
          try {
            setState((previous) => ({
              ...previous,
              isConnecting: true,
              error: "",
              notice: "",
            }));

            await connectWallet({ allowMobileDeeplink: false });

            if (cancelled) {
              return;
            }

            const connectedSnapshot = await getWalletSnapshot();

            if (cancelled) {
              return;
            }

            setState((previous) => ({
              ...previous,
              ...connectedSnapshot,
              isConnecting: false,
              isLoading: false,
              showInstallFallback: false,
              installTarget: getMetaMaskInstallTarget(),
              error: "",
              notice: "",
              mobileInstallUrl: getMetaMaskMobileInstallUrl(),
              mobileDappUrl: getMetaMaskMobileDappUrl(),
            }));
          } catch (error) {
            if (cancelled) {
              return;
            }

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
              isConnecting: false,
              showInstallFallback: previous.showInstallFallback || !previous.hasProvider,
              installTarget: getMetaMaskInstallTarget(),
              error: message,
              notice: "",
              mobileInstallUrl: getMetaMaskMobileInstallUrl(),
              mobileDappUrl: getMetaMaskMobileDappUrl(),
            }));
          } finally {
            clearPendingMetaMaskMobileConnectIntent();
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          hasProvider: hasWalletConnector(),
          isLoading: false,
          isDisconnecting: false,
          showInstallFallback: !hasWalletConnector(),
          installTarget: getMetaMaskInstallTarget(),
          error: error instanceof Error ? error.message : "Unable to check the wallet connection right now.",
          notice: "",
          mobileInstallUrl: getMetaMaskMobileInstallUrl(),
          mobileDappUrl: getMetaMaskMobileDappUrl(),
        }));
      }
    }

    setState((previous) => ({
      ...previous,
      hasProvider: hasWalletConnector(),
      isLoading: true,
      showInstallFallback: !hasWalletConnector(),
      installTarget: getMetaMaskInstallTarget(),
      notice: "",
      mobileInstallUrl: getMetaMaskMobileInstallUrl(),
      mobileDappUrl: getMetaMaskMobileDappUrl(),
    }));

    void syncWallet();

    const handleWalletUpdate = () => {
      void syncWallet({ eager: true });
    };

    void (async () => {
      unsubscribe = await subscribeToWalletEvents(handleWalletUpdate);
    })();

    return () => {
      cancelled = true;
      clearMobileInstallFallbackTimer();
      unsubscribe();
    };
  }, []);

  async function handleConnectWallet() {
    clearMobileInstallFallbackTimer();

    setState((previous) => ({
      ...previous,
      hasProvider: hasWalletConnector(),
      isConnecting: true,
      error: "",
      notice: "",
      showInstallFallback: false,
      installTarget: getMetaMaskInstallTarget(),
      mobileInstallUrl: getMetaMaskMobileInstallUrl(),
      mobileDappUrl: getMetaMaskMobileDappUrl(),
    }));

    try {
      const account = await connectWallet();

      if (!account) {
        throw new Error("No wallet account was returned.");
      }

      const snapshot = await getWalletSnapshot({ eager: true });

      setState({
        ...initialState,
        ...snapshot,
        isConnecting: false,
        isLoading: false,
        showInstallFallback: false,
        installTarget: getMetaMaskInstallTarget(),
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        mobileDappUrl: getMetaMaskMobileDappUrl(),
      });
    } catch (error) {
      const isRedirect =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "METAMASK_MOBILE_REDIRECT";

      if (isRedirect) {
        scheduleMobileInstallFallback();
      }

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
        isConnecting: isRedirect,
        isLoading: false,
        showInstallFallback: isRedirect ? false : previous.showInstallFallback || !previous.hasProvider,
        installTarget: getMetaMaskInstallTarget(),
        error: isRedirect ? "" : message,
        notice: "",
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        mobileDappUrl: getMetaMaskMobileDappUrl(),
      }));
    }
  }

  async function handleDisconnectWallet() {
    clearMobileInstallFallbackTimer();

    setState((previous) => ({
      ...previous,
      isDisconnecting: true,
      error: "",
      notice: "",
      installTarget: getMetaMaskInstallTarget(),
      mobileInstallUrl: getMetaMaskMobileInstallUrl(),
      mobileDappUrl: getMetaMaskMobileDappUrl(),
    }));

    try {
      await disconnectWallet();
      const snapshot = await getWalletSnapshot({ eager: true });

      setState({
        ...initialState,
        ...snapshot,
        isLoading: false,
        isDisconnecting: false,
        notice: "Wallet disconnected on this device.",
        showInstallFallback: !snapshot.hasProvider,
        installTarget: getMetaMaskInstallTarget(),
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        mobileDappUrl: getMetaMaskMobileDappUrl(),
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        isDisconnecting: false,
        installTarget: getMetaMaskInstallTarget(),
        error: error instanceof Error ? error.message : "Unable to disconnect the wallet right now.",
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        mobileDappUrl: getMetaMaskMobileDappUrl(),
      }));
    }
  }

  return {
    ...state,
    isConnected: Boolean(state.account),
    connectWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
  };
}
