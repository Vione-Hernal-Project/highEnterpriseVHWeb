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
const WALLET_CONNECT_TIMEOUT_MS = 8_000;

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

function getWalletErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "number" || typeof code === "string" ? code : null;
}

function getWalletRawMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    return typeof message === "string" ? message : "";
  }

  return "";
}

function getWalletErrorMessage(error: unknown, fallback: string) {
  const code = getWalletErrorCode(error);
  const rawMessage = getWalletRawMessage(error);
  const normalizedMessage = rawMessage.toLowerCase();

  if (code === 4001) {
    return "Wallet connection was cancelled.";
  }

  if (code === -32002 || normalizedMessage.includes("already processing")) {
    return "MetaMask already has a connection request open. Finish or close the MetaMask window, then try again.";
  }

  if (code === "METAMASK_LOCKED" || normalizedMessage.includes("metamask is locked")) {
    return "MetaMask is locked. Unlock MetaMask from the extension, then choose Ethereum again.";
  }

  if (normalizedMessage.includes("taking too long")) {
    return "MetaMask is taking too long to respond. Unlock or close MetaMask, then try again.";
  }

  if (normalizedMessage.includes("unexpected error")) {
    return "MetaMask could not finish the connection. Unlock or close MetaMask, then try again.";
  }

  return rawMessage || fallback;
}

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
        error: previous.error || "MetaMask did not return a wallet connection to this browser. Return to this page and try again.",
        showInstallFallback: !previous.hasProvider,
        installTarget: getMetaMaskInstallTarget(),
      }));
    }, MOBILE_DEEPLINK_FALLBACK_DELAY_MS);
  }

  function withConnectTimeout<T>(promise: Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("MetaMask is taking too long to respond. Unlock MetaMask, then try again."));
      }, WALLET_CONNECT_TIMEOUT_MS);

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

            const message = getWalletErrorMessage(error, "Unable to connect MetaMask right now.");

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
          error: getWalletErrorMessage(error, "Unable to check the wallet connection right now."),
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

    const handlePageReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      void syncWallet({ eager: true });
    };

    void (async () => {
      unsubscribe = await subscribeToWalletEvents(handleWalletUpdate);
    })();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handlePageReturn);
    }

    window.addEventListener("focus", handlePageReturn);

    return () => {
      cancelled = true;
      clearMobileInstallFallbackTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handlePageReturn);
      }
      window.removeEventListener("focus", handlePageReturn);
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
      const account = await withConnectTimeout(connectWallet());

      if (!account) {
        throw new Error("No wallet account was returned.");
      }

      setState((previous) => ({
        ...previous,
        account,
        chainId: null,
        isSupportedChain: false,
        vhlBalance: null,
        hasProvider: true,
        isConnecting: false,
        isLoading: false,
        showInstallFallback: false,
        installTarget: getMetaMaskInstallTarget(),
        error: "",
        notice: "Ethereum wallet connected. Checking network...",
        mobileInstallUrl: getMetaMaskMobileInstallUrl(),
        mobileDappUrl: getMetaMaskMobileDappUrl(),
      }));

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

      const message = getWalletErrorMessage(error, "Unable to connect MetaMask right now.");

      setState((previous) => ({
        ...previous,
        hasProvider: hasWalletConnector(),
        isConnecting: false,
        isLoading: false,
        showInstallFallback: isRedirect || previous.account ? false : previous.showInstallFallback || !previous.hasProvider,
        installTarget: getMetaMaskInstallTarget(),
        error: message,
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
        error: getWalletErrorMessage(error, "Unable to disconnect the wallet right now."),
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
