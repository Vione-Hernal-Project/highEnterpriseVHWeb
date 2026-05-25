import { NextResponse } from "next/server";

import { DEFAULT_CHECKOUT_AVAILABILITY_SETTINGS } from "@/lib/checkout-availability";
import { DEFAULT_GENERAL_SETTINGS, loadFreshAdminGeneralSettings } from "@/lib/admin/settings";

function toCheckoutSettingsPayload(settings: {
  shippingPhilippinesEnabled: boolean;
  shippingAsiaEnabled: boolean;
  shippingRestOfWorldEnabled: boolean;
  evmEthEnabled: boolean;
  evmUsdcEnabled: boolean;
  evmUsdtEnabled: boolean;
  solEnabled: boolean;
  solUsdcEnabled: boolean;
  solUsdtEnabled: boolean;
  vat12Enabled: boolean;
  reducedVat5Enabled: boolean;
  zeroRatedVat0Enabled: boolean;
}) {
  return {
    shippingPhilippinesEnabled: settings.shippingPhilippinesEnabled,
    shippingAsiaEnabled: settings.shippingAsiaEnabled,
    shippingRestOfWorldEnabled: settings.shippingRestOfWorldEnabled,
    evmEthEnabled: settings.evmEthEnabled,
    evmUsdcEnabled: settings.evmUsdcEnabled,
    evmUsdtEnabled: settings.evmUsdtEnabled,
    solEnabled: settings.solEnabled,
    solUsdcEnabled: settings.solUsdcEnabled,
    solUsdtEnabled: settings.solUsdtEnabled,
    vat12Enabled: settings.vat12Enabled,
    reducedVat5Enabled: settings.reducedVat5Enabled,
    zeroRatedVat0Enabled: settings.zeroRatedVat0Enabled,
  };
}

export async function GET() {
  try {
    const settings = await loadFreshAdminGeneralSettings();

    return NextResponse.json({
      settings: toCheckoutSettingsPayload(settings),
    });
  } catch {
    return NextResponse.json({
      settings: toCheckoutSettingsPayload({
        ...DEFAULT_CHECKOUT_AVAILABILITY_SETTINGS,
        vat12Enabled: DEFAULT_GENERAL_SETTINGS.vat12Enabled,
        reducedVat5Enabled: DEFAULT_GENERAL_SETTINGS.reducedVat5Enabled,
        zeroRatedVat0Enabled: DEFAULT_GENERAL_SETTINGS.zeroRatedVat0Enabled,
      }),
    });
  }
}
