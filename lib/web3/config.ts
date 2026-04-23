export const MERCHANT_WALLET_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS?.trim() ?? "";

// TODO(mainnet-launch): paste the deployed Ethereum Mainnet VHL contract
// address into NEXT_PUBLIC_VHL_TOKEN_ADDRESS in .env.local.
export const VHL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_VHL_TOKEN_ADDRESS?.trim() ?? "";
export const USDC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS?.trim() ?? "";
export const USDT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS?.trim() ?? "";

export const VHL_TOKEN_SYMBOL = "VHL";
export const VHL_TOKEN_DECIMALS = 18;
export const ETH_TOKEN_SYMBOL = "ETH";
export const ETH_TOKEN_DECIMALS = 18;
export const USDC_TOKEN_SYMBOL = "USDC";
export const USDC_TOKEN_DECIMALS = 6;
export const USDT_TOKEN_SYMBOL = "USDT";
export const USDT_TOKEN_DECIMALS = 6;

export const VHL_ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];
export const ERC20_PAYMENT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 value) returns (bool)",
];
