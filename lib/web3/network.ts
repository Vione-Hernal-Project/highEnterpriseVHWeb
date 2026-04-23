import { getAddress, isAddress } from "ethers";

export const ETHEREUM_MAINNET_CHAIN_ID = 1;
export const ETHEREUM_MAINNET_CHAIN_HEX = "0x1";
export const ETHEREUM_MAINNET_NETWORK_NAME = "Ethereum Mainnet";
export const ETHEREUM_MAINNET_EXPLORER_LABEL = "Etherscan";
export const ETHEREUM_MAINNET_EXPLORER_BASE_URL = "https://etherscan.io";
export const ETHEREUM_MAINNET_RPC_ENV_NAME = "ETHEREUM_MAINNET_RPC_URL";

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

export function getAddressExplorerUrl(address: string | null | undefined) {
  const normalizedAddress = (address || "").trim();

  if (!isAddress(normalizedAddress)) {
    return null;
  }

  return `${ETHEREUM_MAINNET_EXPLORER_BASE_URL}/address/${getAddress(normalizedAddress)}`;
}
