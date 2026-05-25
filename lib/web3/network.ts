import { getAddress, isAddress } from "ethers";

export const ETHEREUM_MAINNET_CHAIN_ID = 1;
export const ETHEREUM_MAINNET_CHAIN_HEX = "0x1";
export const ETHEREUM_MAINNET_NETWORK_NAME = "Ethereum Mainnet";
export const ETHEREUM_MAINNET_EXPLORER_LABEL = "Etherscan";
export const ETHEREUM_MAINNET_EXPLORER_BASE_URL = "https://etherscan.io";
export const ETHEREUM_MAINNET_RPC_ENV_NAME = "ETHEREUM_MAINNET_RPC_URL";
export const SOLANA_MAINNET_CHAIN_ID = 101;
export const SOLANA_MAINNET_NETWORK_NAME = "Solana Mainnet";
export const SOLANA_EXPLORER_LABEL = "Solscan";
export const SOLANA_EXPLORER_BASE_URL = "https://solscan.io";

export function isEthereumMainnetChain(chainId: bigint | number | null | undefined) {
  if (chainId === null || chainId === undefined) {
    return false;
  }

  return Number(chainId) === ETHEREUM_MAINNET_CHAIN_ID;
}

export function getEthereumMainnetRequirementMessage(action: string) {
  return `Switch MetaMask to ${ETHEREUM_MAINNET_NETWORK_NAME} before ${action}.`;
}

export function getTransactionExplorerUrl(txHash: string | null | undefined) {
  const normalizedHash = (txHash || "").trim();

  if (!/^0x([A-Fa-f0-9]{64})$/.test(normalizedHash)) {
    return null;
  }

  return `${ETHEREUM_MAINNET_EXPLORER_BASE_URL}/tx/${normalizedHash}`;
}

export function getSolanaTransactionExplorerUrl(signature: string | null | undefined) {
  const normalizedSignature = (signature || "").trim();

  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(normalizedSignature)) {
    return null;
  }

  return `${SOLANA_EXPLORER_BASE_URL}/tx/${normalizedSignature}`;
}

export function getAddressExplorerUrl(address: string | null | undefined) {
  const normalizedAddress = (address || "").trim();

  if (!isAddress(normalizedAddress)) {
    return null;
  }

  return `${ETHEREUM_MAINNET_EXPLORER_BASE_URL}/address/${getAddress(normalizedAddress)}`;
}

export function getSolanaAddressExplorerUrl(address: string | null | undefined) {
  const normalizedAddress = (address || "").trim();

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalizedAddress)) {
    return null;
  }

  return `${SOLANA_EXPLORER_BASE_URL}/account/${normalizedAddress}`;
}

export function getPaymentTransactionExplorerUrl(paymentMethod: string | null | undefined, txHash: string | null | undefined) {
  return paymentMethod?.startsWith("sol_") ? getSolanaTransactionExplorerUrl(txHash) : getTransactionExplorerUrl(txHash);
}

export function getPaymentAddressExplorerUrl(paymentMethod: string | null | undefined, address: string | null | undefined) {
  return paymentMethod?.startsWith("sol_") ? getSolanaAddressExplorerUrl(address) : getAddressExplorerUrl(address);
}
