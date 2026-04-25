import { createEVMClient, type MetamaskConnectEVM } from "@metamask/connect-evm";
import { BrowserProvider, Contract, formatUnits, isAddress, type Eip1193Provider } from "ethers";

import {
  VHL_ERC20_ABI,
  VHL_TOKEN_ADDRESS,
  VHL_TOKEN_DECIMALS,
} from "@/lib/web3/config";
import {
  ETHEREUM_MAINNET_CHAIN_HEX,
  ETHEREUM_MAINNET_CHAIN_ID,
  ETHEREUM_MAINNET_NETWORK_NAME,
  getEthereumMainnetRequirementMessage,
  isEthereumMainnetChain,
} from "@/lib/web3/network";

type InjectedEthereum = Eip1193Provider & {
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isPhantom?: boolean;
  _metamask?: unknown;
  on?: (event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void) => void;
  providers?: InjectedEthereum[];
};

type Eip6963ProviderDetail = {
  info?: {
    name?: string;
    rdns?: string;
    uuid?: string;
  };
  provider?: InjectedEthereum;
};

type WalletSnapshot = {
  account: string | null;
  chainId: number | null;
  isSupportedChain: boolean;
  vhlBalance: string | null;
  hasProvider: boolean;
};

type WalletEventSource = Eip1193Provider & {
  on?: (...args: unknown[]) => void;
  removeListener?: (...args: unknown[]) => void;
};

export type MetaMaskInstallTarget = {
  href: string;
  label: string;
  platform: "ios" | "android" | "desktop";
};

const METAMASK_CONNECT_PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_METAMASK_CONNECT_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_URL?.trim() ||
  "";
const METAMASK_MOBILE_INSTALL_URL = "https://metamask.io/download/";
const METAMASK_DESKTOP_DOWNLOAD_URL = "https://metamask.io/download/";
const METAMASK_IOS_APP_STORE_URL = "https://apps.apple.com/us/app/metamask-trade-crypto/id1438144202";
const METAMASK_ANDROID_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=io.metamask";
const METAMASK_MOBILE_DAPP_LINK_BASE = "https://metamask.app.link/dapp/";
const METAMASK_MOBILE_ACTION_QUERY_PARAM = "vh_wallet_action";
const METAMASK_MOBILE_CONNECT_ACTION = "connect";
const WALLET_DISCONNECT_OVERRIDE_KEY = "vh.wallet.disconnectOverride";
const WALLET_CONNECTED_PREFERENCE_KEY = "vh.wallet.connectedPreference";
const METAMASK_CONNECT_MOBILE_REQUIRED_MESSAGE =
  "Mobile wallet approval needs MetaMask Connect so the original browser can receive the wallet session. Add NEXT_PUBLIC_METAMASK_CONNECT_RPC_URL and try again.";

let metaMaskConnectClientPromise: Promise<MetamaskConnectEVM> | null = null;
let eip6963ProviderListenerAttached = false;
const announcedEip6963Providers: Eip6963ProviderDetail[] = [];

function getEthereumWindow() {
  return window as Window & {
    ethereum?: InjectedEthereum;
  };
}

function rememberEip6963Provider(detail: Eip6963ProviderDetail | undefined) {
  if (!detail?.provider) {
    return;
  }

  const existingProviderIndex = announcedEip6963Providers.findIndex((announced) => announced.provider === detail.provider);

  if (existingProviderIndex >= 0) {
    announcedEip6963Providers[existingProviderIndex] = detail;
    return;
  }

  announcedEip6963Providers.push(detail);
}

function requestEip6963Providers() {
  if (typeof window === "undefined") {
    return;
  }

  if (!eip6963ProviderListenerAttached) {
    window.addEventListener("eip6963:announceProvider", ((event: CustomEvent<Eip6963ProviderDetail>) => {
      rememberEip6963Provider(event.detail);
    }) as EventListener);
    eip6963ProviderListenerAttached = true;
  }

  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function isLikelyMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const touchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || touchMac;
}

function isMetaMaskMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /MetaMaskMobile/i.test(navigator.userAgent || "");
}

function readDisconnectOverride() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(WALLET_DISCONNECT_OVERRIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function readConnectedPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(WALLET_CONNECTED_PREFERENCE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDisconnectOverride(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(WALLET_DISCONNECT_OVERRIDE_KEY, "1");
    } else {
      window.localStorage.removeItem(WALLET_DISCONNECT_OVERRIDE_KEY);
    }
  } catch {
    // Ignore storage access failures so wallet UX keeps working in restricted browsers.
  }
}

function writeConnectedPreference(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(WALLET_CONNECTED_PREFERENCE_KEY, "1");
    } else {
      window.localStorage.removeItem(WALLET_CONNECTED_PREFERENCE_KEY);
    }
  } catch {
    // Ignore storage access failures so wallet UX keeps working in restricted browsers.
  }
}

function shouldUseMetaMaskMobileDeeplink() {
  if (typeof window === "undefined") {
    return false;
  }

  return !getInjectedEthereum() && isLikelyMobileBrowser() && !isMetaMaskMobileBrowser() && !canUseMetaMaskConnectMobile();
}

function buildMetaMaskMobileDappLink(action?: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentUrl = new URL(window.location.href);

  if (action) {
    currentUrl.searchParams.set(METAMASK_MOBILE_ACTION_QUERY_PARAM, action);
  }

  const dappTarget = `${currentUrl.host}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`.replace(/^\/+/, "");

  if (!dappTarget) {
    return null;
  }

  return `${METAMASK_MOBILE_DAPP_LINK_BASE}${dappTarget}`;
}

function clearPendingMetaMaskMobileAction() {
  if (typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(window.location.href);

  if (!currentUrl.searchParams.has(METAMASK_MOBILE_ACTION_QUERY_PARAM)) {
    return;
  }

  currentUrl.searchParams.delete(METAMASK_MOBILE_ACTION_QUERY_PARAM);
  window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}

function openMetaMaskMobileDapp(action: string) {
  const deeplink = buildMetaMaskMobileDappLink(action);

  if (!deeplink) {
    return null;
  }

  window.location.assign(deeplink);
  return deeplink;
}

function canUseMetaMaskConnectMobile() {
  if (typeof window === "undefined") {
    return false;
  }

  return !getInjectedEthereum() && isLikelyMobileBrowser() && !isMetaMaskMobileBrowser() && Boolean(METAMASK_CONNECT_PUBLIC_RPC_URL);
}

async function getMetaMaskConnectClient() {
  if (!canUseMetaMaskConnectMobile()) {
    return null;
  }

  if (!metaMaskConnectClientPromise) {
    metaMaskConnectClientPromise = createEVMClient({
      dapp: {
        name: "Vione Hernal",
        url: window.location.origin,
      },
      api: {
        supportedNetworks: {
          [ETHEREUM_MAINNET_CHAIN_HEX]: METAMASK_CONNECT_PUBLIC_RPC_URL,
        },
      },
      ui: {
        preferExtension: true,
        showInstallModal: false,
      },
      mobile: {
        useDeeplink: false,
      },
    }).catch((error) => {
      metaMaskConnectClientPromise = null;
      throw error;
    });
  }

  return metaMaskConnectClientPromise;
}

async function getWalletEventSource(): Promise<WalletEventSource | null> {
  const injectedProvider = getInjectedEthereum();

  if (injectedProvider) {
    return injectedProvider as WalletEventSource;
  }

  const connectClient = await getMetaMaskConnectClient();

  return (connectClient?.getProvider() as WalletEventSource | null) ?? null;
}

async function getActiveEip1193Provider() {
  const injectedProvider = getInjectedEthereum();

  if (injectedProvider) {
    return injectedProvider;
  }

  const connectClient = await getMetaMaskConnectClient();

  return connectClient?.getProvider() ?? null;
}

function isPreferredMetaMaskProvider(provider: InjectedEthereum) {
  return Boolean(provider.isMetaMask) && !provider.isBraveWallet && !provider.isCoinbaseWallet && !provider.isPhantom;
}

function isMetaMaskEip6963Provider(detail: Eip6963ProviderDetail) {
  const rdns = detail.info?.rdns?.toLowerCase() ?? "";
  const name = detail.info?.name?.toLowerCase() ?? "";

  return rdns === "io.metamask" || name === "metamask" || Boolean(detail.provider && isPreferredMetaMaskProvider(detail.provider));
}

function getAnnouncedMetaMaskProvider() {
  requestEip6963Providers();

  const exactMetaMaskProvider = announcedEip6963Providers.find(
    (detail) => detail.provider && isMetaMaskEip6963Provider(detail),
  );

  return exactMetaMaskProvider?.provider ?? null;
}

function selectMetaMaskProvider(ethereum: InjectedEthereum) {
  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    const exactMetaMaskProvider = ethereum.providers.find((provider) => isPreferredMetaMaskProvider(provider));

    if (exactMetaMaskProvider) {
      return exactMetaMaskProvider;
    }

    const metamaskSdkProvider = ethereum.providers.find(
      (provider) => provider.isMetaMask && Boolean(provider._metamask) && !provider.isPhantom,
    );

    if (metamaskSdkProvider) {
      return metamaskSdkProvider;
    }

    return ethereum.providers.find((provider) => provider.isMetaMask && !provider.isPhantom) ?? null;
  }

  if (isPreferredMetaMaskProvider(ethereum)) {
    return ethereum;
  }

  return ethereum.isMetaMask && !ethereum.isPhantom ? ethereum : null;
}

export function getInjectedEthereum() {
  if (typeof window === "undefined") {
    return null;
  }

  const announcedProvider = getAnnouncedMetaMaskProvider();

  if (announcedProvider) {
    return announcedProvider;
  }

  const injected = getEthereumWindow().ethereum;

  if (!injected) {
    return null;
  }

  return selectMetaMaskProvider(injected);
}

export function shouldRestoreWalletSession() {
  return !readDisconnectOverride() && readConnectedPreference();
}

export async function getBrowserProvider() {
  const ethereum = await getActiveEip1193Provider();

  if (!ethereum) {
    return null;
  }

  return new BrowserProvider(ethereum);
}

// Uses the quiet account check so the page can restore a previous connection
// without prompting MetaMask every time the user loads the site.
export async function getCurrentAccount(options?: { eager?: boolean }) {
  if (readDisconnectOverride()) {
    return null;
  }

  if (options?.eager === false && !shouldRestoreWalletSession()) {
    return null;
  }

  const ethereum = await getActiveEip1193Provider();

  if (!ethereum) {
    return null;
  }

  const accounts = (await ethereum.request({
    method: "eth_accounts",
  })) as string[];

  return accounts[0] ?? null;
}

// Uses the standard MetaMask request flow when the user explicitly clicks
// the connect action in the UI.
export async function connectWallet(options?: { allowMobileDeeplink?: boolean }) {
  writeDisconnectOverride(false);

  const ethereum = getInjectedEthereum();

  if (ethereum) {
    const accounts = (await ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const account = accounts[0] ?? null;

    if (account) {
      writeConnectedPreference(true);
    }

    clearPendingMetaMaskMobileAction();
    return account;
  }

  const connectClient = await getMetaMaskConnectClient();

  if (connectClient) {
    const { accounts } = await connectClient.connect({
      chainIds: [ETHEREUM_MAINNET_CHAIN_HEX],
    });
    const account = accounts[0] ?? null;

    if (account) {
      writeConnectedPreference(true);
    }

    clearPendingMetaMaskMobileAction();
    return account;
  }

  if (shouldUseMetaMaskMobileDeeplink() && options?.allowMobileDeeplink !== false) {
    throw Object.assign(new Error(METAMASK_CONNECT_MOBILE_REQUIRED_MESSAGE), {
      code: "METAMASK_MOBILE_REDIRECT",
    });
  }

  if (isLikelyMobileBrowser()) {
    throw new Error(
      METAMASK_CONNECT_PUBLIC_RPC_URL
        ? "MetaMask is not available on this mobile browser. Install or open the MetaMask app and try again."
        : "MetaMask mobile connect is not configured yet. Add NEXT_PUBLIC_METAMASK_CONNECT_RPC_URL for mobile wallet support.",
    );
  }

  throw new Error("MetaMask is not available in this browser.");
}

export async function disconnectWallet() {
  writeDisconnectOverride(true);
  writeConnectedPreference(false);
  clearPendingMetaMaskMobileAction();

  const ethereum = getInjectedEthereum();

  if (ethereum) {
    try {
      await ethereum.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some providers do not support programmatic permission revocation.
      // We still keep the frontend disconnected for this device/session.
    }
  }

  try {
    const connectClient = await getMetaMaskConnectClient();
    await connectClient?.disconnect();
  } catch {
    // Best-effort cleanup for older MetaMask Connect sessions.
  }
}

export async function checkChain(provider?: BrowserProvider | null) {
  const ethereum = await getActiveEip1193Provider();

  if (!ethereum) {
    return {
      chainId: null,
      isSupportedChain: false,
    };
  }

  const rawChainId = (await ethereum.request({
    method: "eth_chainId",
  })) as string | number;

  const chainId =
    typeof rawChainId === "string"
      ? Number.parseInt(rawChainId, rawChainId.startsWith("0x") ? 16 : 10)
      : Number(rawChainId);

  return {
    chainId,
    isSupportedChain: isEthereumMainnetChain(chainId),
  };
}

export async function ensureEthereumMainnetChain() {
  const ethereum = await getActiveEip1193Provider();

  if (!ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const { isSupportedChain } = await checkChain();

  if (isSupportedChain) {
    return {
      chainId: ETHEREUM_MAINNET_CHAIN_ID,
      isSupportedChain: true,
    };
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETHEREUM_MAINNET_CHAIN_HEX }],
    });
  } catch (error) {
    const providerError =
      typeof error === "object" && error !== null
        ? (error as { code?: number; message?: string })
        : null;

    if (providerError?.code === 4001) {
      throw new Error(getEthereumMainnetRequirementMessage("continuing"));
    }

    if (providerError?.code === 4902) {
      throw new Error(`Ethereum Mainnet is not available in this MetaMask instance. Add ${ETHEREUM_MAINNET_NETWORK_NAME} and try again.`);
    } else {
      throw new Error(getEthereumMainnetRequirementMessage("continuing"));
    }
  }

  const refreshedChain = await checkChain();

  if (!refreshedChain.isSupportedChain) {
    throw new Error(getEthereumMainnetRequirementMessage("continuing"));
  }

  return refreshedChain;
}

export async function getVhlBalance(address: string, provider?: BrowserProvider | null) {
  const activeProvider = provider ?? (await getBrowserProvider());

  if (!address || !activeProvider || !isAddress(VHL_TOKEN_ADDRESS)) {
    return null;
  }

  const contract = new Contract(VHL_TOKEN_ADDRESS, VHL_ERC20_ABI, activeProvider);
  const balance = await contract.balanceOf(address);

  return formatUnits(balance, VHL_TOKEN_DECIMALS);
}

export function formatVhlBalance(balance: string | null) {
  if (!balance) {
    return "0";
  }

  const numeric = Number(balance);

  if (!Number.isFinite(numeric)) {
    return balance;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(numeric);
}

export async function getWalletSnapshot(options?: { eager?: boolean }): Promise<WalletSnapshot> {
  const shouldEagerlyQueryProvider = options?.eager !== false;
  const hasProvider = hasWalletConnector();

  if (!shouldEagerlyQueryProvider && !shouldRestoreWalletSession()) {
    return {
      account: null,
      chainId: null,
      isSupportedChain: false,
      vhlBalance: null,
      hasProvider,
    };
  }

  const provider = await getBrowserProvider();
  const account = await getCurrentAccount({ eager: shouldEagerlyQueryProvider });
  let chainId: number | null = null;
  let isSupportedChain = false;
  let vhlBalance: string | null = null;

  if (account) {
    const chainSnapshot = await checkChain(provider);
    chainId = chainSnapshot.chainId;
    isSupportedChain = chainSnapshot.isSupportedChain;
    vhlBalance = isSupportedChain ? await getVhlBalance(account, provider) : null;
  }

  return {
    account,
    chainId,
    isSupportedChain,
    vhlBalance,
    hasProvider: Boolean(provider) || hasProvider,
  };
}

export function hasWalletConnector() {
  return Boolean(getInjectedEthereum()) || canUseMetaMaskConnectMobile();
}

export function getMetaMaskMobileInstallUrl() {
  return isLikelyMobileBrowser() ? METAMASK_MOBILE_INSTALL_URL : null;
}

export function getMetaMaskInstallTarget(): MetaMaskInstallTarget {
  if (typeof navigator !== "undefined") {
    const userAgent = navigator.userAgent || "";

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return {
        href: METAMASK_IOS_APP_STORE_URL,
        label: "Install MetaMask for iPhone",
        platform: "ios",
      };
    }

    if (/Android/i.test(userAgent)) {
      return {
        href: METAMASK_ANDROID_PLAY_STORE_URL,
        label: "Install MetaMask for Android",
        platform: "android",
      };
    }
  }

  return {
    href: METAMASK_DESKTOP_DOWNLOAD_URL,
    label: "Install MetaMask",
    platform: "desktop",
  };
}

export function getMetaMaskMobileDappUrl() {
  return shouldUseMetaMaskMobileDeeplink() ? buildMetaMaskMobileDappLink(METAMASK_MOBILE_CONNECT_ACTION) : null;
}

export function hasPendingMetaMaskMobileConnectIntent() {
  if (typeof window === "undefined") {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  return currentUrl.searchParams.get(METAMASK_MOBILE_ACTION_QUERY_PARAM) === METAMASK_MOBILE_CONNECT_ACTION;
}

export function clearPendingMetaMaskMobileConnectIntent() {
  clearPendingMetaMaskMobileAction();
}

export async function subscribeToWalletEvents(listener: () => void) {
  if (!getInjectedEthereum() && !shouldRestoreWalletSession() && !hasPendingMetaMaskMobileConnectIntent()) {
    return () => {};
  }

  const provider = await getWalletEventSource();

  if (!provider?.on) {
    return () => {};
  }

  provider.on("accountsChanged", listener);
  provider.on("chainChanged", listener);
  provider.on("connect", listener);
  provider.on("disconnect", listener);

  return () => {
    if (provider.removeListener) {
      provider.removeListener("accountsChanged", listener);
      provider.removeListener("chainChanged", listener);
      provider.removeListener("connect", listener);
      provider.removeListener("disconnect", listener);
    }
  };
}
