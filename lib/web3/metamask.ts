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

function getEthereumWindow() {
  return window as Window & {
    ethereum?: InjectedEthereum;
  };
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
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    return null;
  }

  return new BrowserProvider(ethereum);
}

// Uses the quiet account check so the page can restore a previous connection
// without prompting MetaMask every time the user loads the site.
export async function getCurrentAccount() {
  const ethereum = getInjectedEthereum();

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

  if (!ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  return accounts[0] ?? null;
}

export async function checkChain(provider?: BrowserProvider | null) {
  const ethereum = getInjectedEthereum();

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
  const ethereum = getInjectedEthereum();

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
    hasProvider: Boolean(provider),
  };
}
