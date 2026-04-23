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
  _metamask?: unknown;
  on?: (event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void) => void;
  providers?: InjectedEthereum[];
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

const METAMASK_CONNECT_PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_METAMASK_CONNECT_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_URL?.trim() ||
  "";
const METAMASK_MOBILE_INSTALL_URL = "https://metamask.io/download/";

let metaMaskConnectClientPromise: Promise<MetamaskConnectEVM> | null = null;

function getEthereumWindow() {
  return window as Window & {
    ethereum?: InjectedEthereum;
  };
}

function isLikelyMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const touchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || touchMac;
}

function canUseMetaMaskConnectMobile() {
  if (typeof window === "undefined") {
    return false;
  }

  return !getInjectedEthereum() && isLikelyMobileBrowser() && Boolean(METAMASK_CONNECT_PUBLIC_RPC_URL);
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
        preferExtension: false,
        showInstallModal: false,
      },
      mobile: {
        // Mobile-only: let MetaMask Connect open the wallet app with its official deeplink flow.
        preferredOpenLink: (deeplink: string) => {
          window.location.assign(deeplink);
        },
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

function selectMetaMaskProvider(ethereum: InjectedEthereum) {
  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    const exactMetaMaskProvider = ethereum.providers.find(
      (provider) => provider.isMetaMask && !provider.isBraveWallet && !provider.isCoinbaseWallet,
    );

    if (exactMetaMaskProvider) {
      return exactMetaMaskProvider;
    }

    const metamaskSdkProvider = ethereum.providers.find((provider) => provider.isMetaMask && Boolean(provider._metamask));

    if (metamaskSdkProvider) {
      return metamaskSdkProvider;
    }

    return ethereum.providers.find((provider) => provider.isMetaMask) ?? ethereum.providers[0] ?? ethereum;
  }

  return ethereum;
}

export function getInjectedEthereum() {
  if (typeof window === "undefined") {
    return null;
  }

  const injected = getEthereumWindow().ethereum;

  if (!injected) {
    return null;
  }

  return selectMetaMaskProvider(injected);
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
export async function getCurrentAccount() {
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
export async function connectWallet() {
  const ethereum = getInjectedEthereum();

  if (ethereum) {
    const accounts = (await ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];

    return accounts[0] ?? null;
  }

  const connectClient = await getMetaMaskConnectClient();

  if (!connectClient) {
    if (isLikelyMobileBrowser()) {
      throw new Error(
        METAMASK_CONNECT_PUBLIC_RPC_URL
          ? "MetaMask is not available on this mobile browser. Install or open the MetaMask app and try again."
          : "MetaMask mobile connect is not configured yet. Add NEXT_PUBLIC_METAMASK_CONNECT_RPC_URL for mobile wallet support.",
      );
    }

    throw new Error("MetaMask is not available in this browser.");
  }

  const { accounts } = await connectClient.connect({
    chainIds: [ETHEREUM_MAINNET_CHAIN_HEX],
  });

  return accounts[0] ?? null;
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

export async function getWalletSnapshot(): Promise<WalletSnapshot> {
  const provider = await getBrowserProvider();
  const account = await getCurrentAccount();
  const { chainId, isSupportedChain } = await checkChain(provider);
  const vhlBalance = account && isSupportedChain ? await getVhlBalance(account, provider) : null;

  return {
    account,
    chainId,
    isSupportedChain,
    vhlBalance,
    hasProvider: Boolean(provider) || canUseMetaMaskConnectMobile(),
  };
}

export function hasWalletConnector() {
  return Boolean(getInjectedEthereum()) || canUseMetaMaskConnectMobile();
}

export function getMetaMaskMobileInstallUrl() {
  return isLikelyMobileBrowser() ? METAMASK_MOBILE_INSTALL_URL : null;
}

export async function subscribeToWalletEvents(listener: () => void) {
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
