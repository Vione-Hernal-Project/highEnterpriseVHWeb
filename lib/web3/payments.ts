import { Contract, getAddress, isAddress, parseUnits, type BrowserProvider, type JsonRpcSigner } from "ethers";

import { normalizePaymentAmount } from "@/lib/payments/amounts";
import { logPaymentDebug } from "@/lib/payments/debug";
import { getPaymentMethodConfig, getPaymentMethodLabel, getPaymentMethodSetupError, type PaymentMethod } from "@/lib/payments/options";
import { ERC20_PAYMENT_ABI, MERCHANT_WALLET_ADDRESS, SEPOLIA_CHAIN_ID } from "@/lib/web3/config";
import { connectWallet, ensureSepoliaChain, getBrowserProvider, getCurrentAccount } from "@/lib/web3/metamask";

type SendCryptoPaymentInput = {
  amount: string | number;
  paymentMethod: PaymentMethod;
  preparedWallet?: PreparedWalletSession;
  recipientAddress?: string | null;
};

type SendCryptoPaymentResult = {
  walletAddress: string;
  txHash: string;
};

export type PreparedWalletSession = {
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  walletAddress: string;
};

function resolveRecipientAddress(recipientAddress: string | null | undefined) {
  const value = (recipientAddress || MERCHANT_WALLET_ADDRESS || "").trim();

  if (!isAddress(value)) {
    throw new Error("Recipient wallet address is invalid.");
  }

  return getAddress(value);
}

export async function prepareWalletForPayment(paymentMethod: PaymentMethod): Promise<PreparedWalletSession> {
  const setupError = getPaymentMethodSetupError(paymentMethod);

  if (setupError) {
    throw new Error(setupError);
  }

  const provider = await getBrowserProvider();

  if (!provider) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const currentAccount = (await getCurrentAccount()) || (await connectWallet());

  if (!currentAccount) {
    throw new Error("Connect your MetaMask wallet before paying.");
  }

  await ensureSepoliaChain();

  const refreshedProvider = (await getBrowserProvider()) ?? provider;
  const signer = await refreshedProvider.getSigner();
  const signerAddress = await signer.getAddress();

  logPaymentDebug("client-wallet-ready", {
    paymentMethod,
    connectedWalletAddress: signerAddress,
    chainId: SEPOLIA_CHAIN_ID,
  });

  return {
    provider: refreshedProvider,
    signer,
    walletAddress: signerAddress,
  };
}

export async function validateWalletCanPay(input: SendCryptoPaymentInput) {
  const preparedWallet = input.preparedWallet ?? (await prepareWalletForPayment(input.paymentMethod));
  const config = getPaymentMethodConfig(input.paymentMethod);
  const normalizedAmount = normalizePaymentAmount(input.amount);

  if (!config) {
    throw new Error("Unsupported payment method.");
  }

  if (config.kind === "native") {
    const expectedAmount = parseUnits(normalizedAmount, config.decimals);
    const walletBalance = await preparedWallet.provider.getBalance(preparedWallet.walletAddress);

    logPaymentDebug("client-wallet-balance", {
      paymentMethod: input.paymentMethod,
      connectedWalletAddress: preparedWallet.walletAddress,
      chainId: SEPOLIA_CHAIN_ID,
      amountExpected: normalizedAmount,
      balanceRaw: walletBalance.toString(),
    });

    if (walletBalance < expectedAmount) {
      throw new Error(`Not enough ${config.label} is available in the connected wallet for this payment.`);
    }

    return preparedWallet;
  }

  if (!config.tokenAddress) {
    throw new Error(`The ${config.label} token address is not configured.`);
  }

  const tokenContract = new Contract(config.tokenAddress, ERC20_PAYMENT_ABI, preparedWallet.provider);
  const decimals = Number((await tokenContract.decimals().catch(() => config.decimals)) ?? config.decimals);
  const expectedAmount = parseUnits(normalizedAmount, decimals);
  const walletBalance = (await tokenContract.balanceOf(preparedWallet.walletAddress)) as bigint;

  logPaymentDebug("client-wallet-balance", {
    paymentMethod: input.paymentMethod,
    connectedWalletAddress: preparedWallet.walletAddress,
    chainId: SEPOLIA_CHAIN_ID,
    amountExpected: normalizedAmount,
    balanceRaw: walletBalance.toString(),
  });

  if (walletBalance < expectedAmount) {
    throw new Error(`Not enough ${config.label} is available in the connected wallet for this payment.`);
  }

  return preparedWallet;
}

export async function sendCryptoPayment(input: SendCryptoPaymentInput): Promise<SendCryptoPaymentResult> {
  const preparedWallet = await validateWalletCanPay(input);
  const normalizedAmount = normalizePaymentAmount(input.amount);

  const config = getPaymentMethodConfig(input.paymentMethod);

  if (!config) {
    throw new Error("Unsupported payment method.");
  }

  const signer = preparedWallet.signer;
  const signerAddress = preparedWallet.walletAddress;
  const recipientAddress = resolveRecipientAddress(input.recipientAddress);

  logPaymentDebug("client-send-start", {
    paymentMethod: input.paymentMethod,
    connectedWalletAddress: signerAddress,
    recipientAddress,
    chainId: SEPOLIA_CHAIN_ID,
    amountExpected: normalizedAmount,
  });

  let tx;

  if (config.kind === "native") {
    tx = await signer.sendTransaction({
      to: recipientAddress,
      value: parseUnits(normalizedAmount, config.decimals),
    });
  } else {
    if (!config.tokenAddress) {
      throw new Error(`The ${config.label} token address is not configured.`);
    }

    const contract = new Contract(config.tokenAddress, ERC20_PAYMENT_ABI, signer);
    const decimals = Number((await contract.decimals().catch(() => config.decimals)) ?? config.decimals);
    const amountInBaseUnits = parseUnits(normalizedAmount, decimals);

    // We use direct token transfers for the Sepolia MVP so MetaMask shows a
    // real send popup without adding checkout contract complexity yet.
    tx = await contract.transfer(recipientAddress, amountInBaseUnits);
  }

  if (!tx.hash) {
    throw new Error(`MetaMask did not return a ${getPaymentMethodLabel(input.paymentMethod)} transaction hash.`);
  }

  logPaymentDebug("client-send-submitted", {
    paymentMethod: input.paymentMethod,
    connectedWalletAddress: signerAddress,
    recipientAddress,
    chainId: SEPOLIA_CHAIN_ID,
    txHash: tx.hash,
  });

  return {
    walletAddress: signerAddress,
    txHash: tx.hash,
  };
}
