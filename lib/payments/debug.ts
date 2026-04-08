type DebugDetails = Record<string, unknown>;

export function logPaymentDebug(scope: string, details: DebugDetails) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(`[vione-payments:${scope}]`, details);
}
