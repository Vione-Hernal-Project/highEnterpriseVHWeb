import { BrowserProvider, Contract, formatUnits, type Eip1193Provider } from "ethers";

import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK_NAME,
  VHL_ERC20_ABI,
  VHL_TOKEN_ADDRESS,
  VHL_TOKEN_DECIMALS,
} from "@/lib/web3/config";

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
  isSepolia: boolean;
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
      isSepolia: false,
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
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
  };
}

export async function ensureSepoliaChain() {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const { isSepolia } = await checkChain();

  if (isSepolia) {
    return {
      chainId: SEPOLIA_CHAIN_ID,
      isSepolia: true,
    };
  }

  const chainIdHex = `0x${SEPOLIA_CHAIN_ID.toString(16)}`;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    const providerError =
      typeof error === "object" && error !== null
        ? (error as { code?: number; message?: string })
        : null;

    if (providerError?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: SEPOLIA_NETWORK_NAME,
            nativeCurrency: {
              name: "Sepolia ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw new Error(`Switch MetaMask to ${SEPOLIA_NETWORK_NAME} before submitting this payment.`);
    }
  }

  const refreshedChain = await checkChain();

  if (!refreshedChain.isSepolia) {
    throw new Error(`Switch MetaMask to ${SEPOLIA_NETWORK_NAME} before submitting this payment.`);
  }

  return refreshedChain;
}

export async function getVhlBalance(address: string, provider?: BrowserProvider | null) {
  const activeProvider = provider ?? (await getBrowserProvider());

  if (!address || !activeProvider) {
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
  const { chainId, isSepolia } = await checkChain(provider);
  const vhlBalance = account && isSepolia ? await getVhlBalance(account, provider) : null;

  return {
    account,
    chainId,
    isSepolia,
    vhlBalance,
    hasProvider: Boolean(provider),
  };
}
