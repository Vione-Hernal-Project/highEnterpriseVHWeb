import { getErrorMessage } from "@/lib/http";

function readWeb3ErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "number" || typeof code === "string") {
      return code;
    }
  }

  return null;
}

function readWeb3ErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    if ("shortMessage" in error && typeof (error as { shortMessage?: unknown }).shortMessage === "string") {
      return (error as { shortMessage: string }).shortMessage;
    }

    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }

  return "";
}

export function getWeb3ErrorMessage(error: unknown, fallback: string) {
  const code = readWeb3ErrorCode(error);
  const message = readWeb3ErrorMessage(error).toLowerCase();

  if (code === 4001 || message.includes("user rejected") || message.includes("user denied")) {
    return "The MetaMask request was cancelled.";
  }

  if (message.includes("insufficient funds")) {
    return "The connected wallet does not have enough ETH to cover this payment and the network gas fee.";
  }

  if (message.includes("nonce too low") || message.includes("replacement fee too low")) {
    return "MetaMask reported a wallet nonce conflict. Review your recent wallet activity and try again.";
  }

  if (
    message.includes("cannot estimate gas") ||
    message.includes("could not coalesce error") ||
    message.includes("gas required exceeds allowance") ||
    message.includes("intrinsic gas too low")
  ) {
    return "MetaMask could not prepare this transaction. Check the recipient address, asset configuration, and gas availability, then try again.";
  }

  if (
    message.includes("network changed") ||
    message.includes("chain disconnected") ||
    message.includes("disconnected") ||
    message.includes("missing or invalid parameters")
  ) {
    return "The wallet connection changed during the request. Reconnect MetaMask on Ethereum Mainnet and try again.";
  }

  return getErrorMessage(error, fallback);
}
